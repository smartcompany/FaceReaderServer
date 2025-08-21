import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import { getLanguageFromHeaders, getLanguageSpecificPrompt, openAIConfig } from '../_helpers';

const STORAGE_BUCKET = "face-reader";

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Supabase 클라이언트 초기화
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_KEY!
);

// 프롬프트 파일 읽기 함수
async function loadPrompt(language: string): Promise<string> {
  try {
    const promptPath = join(process.cwd(), 'prompts', 'fortune-prediction.txt');
    console.log('프롬프트 파일 경로:', promptPath);
    
    const promptContent = await readFile(promptPath, 'utf-8');
    console.log('프롬프트 내용:', promptContent);
    
    // 언어별 프롬프트 생성
    return getLanguageSpecificPrompt(promptContent, language);
  } catch (error) {
    console.error('프롬프트 파일 읽기 오류:', error);
    // 기본 프롬프트 반환
    const basePrompt = '당신은 전문적인 운세 예측가이자 관상학자입니다. 사용자의 얼굴 사진을 분석하여 운세를 예측해주세요.';
    return getLanguageSpecificPrompt(basePrompt, language);
  }
}

export async function POST(request: NextRequest) {
  try {
    // 언어 정보 추출
    const language = getLanguageFromHeaders(request);
    console.log('요청 언어:', language);
    
    // 요청에서 이미지 파일 추출
    const formData = await request.formData();
    const imageFile = formData.get('image') as File;
    
    if (!imageFile) {
      return NextResponse.json(
        { error: '이미지 파일이 필요합니다.' },
        { status: 400 }
      );
    }

    console.log('업로드된 파일:', imageFile.name, '크기:', imageFile.size);

    // 이미지 파일을 버퍼로 변환
    const bytes = await imageFile.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Supabase Storage에 업로드
    const fileName = `fortune-prediction/${Date.now()}-${imageFile.name}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(fileName, buffer, {
        contentType: imageFile.type,
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Supabase 업로드 오류:', uploadError);
      return NextResponse.json(
        { error: '이미지 업로드 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    // 공개 URL 생성
    const { data: { publicUrl } } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(fileName);

    console.log('Supabase 업로드 완료:', publicUrl);

    // 프롬프트 로드
    const prompt = await loadPrompt(language);
    
    // OpenAI API 호출
    const response = await openai.chat.completions.create({
      ...openAIConfig,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt
            },
            {
              type: "image_url",
              image_url: {
                url: publicUrl
              }
            }
          ]
        }
      ],
      response_format: {
        type: "json_object"
      },
    });

    const fortuneResult = response.choices[0]?.message?.content;
    
    if (!fortuneResult) {
      return NextResponse.json(
        { error: 'AI 운세 예측 결과를 생성할 수 없습니다.' },
        { status: 500 }
      );
    }

    // JSON 응답 파싱 및 검증
    let parsedFortune;
    try {
      console.log('AI 원본 응답:', fortuneResult);
      
      // JSON 코드 블록이 있는 경우 추출
      const jsonMatch = fortuneResult.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonString = jsonMatch ? jsonMatch[1] : fortuneResult;
      
      // JSON 문자열 정리 (불필요한 공백, 줄바꿈 제거)
      const cleanJsonString = jsonString.trim().replace(/\n/g, ' ').replace(/\r/g, '');
      
      console.log('정리된 JSON 문자열:', cleanJsonString);
      
      parsedFortune = JSON.parse(cleanJsonString);
      
      // 필수 필드 검증
      const requiredFields = [
        'overall_score', 'wealth_fortune', 'health_fortune', 'love_fortune',
        'career_fortune', 'luck_improvement', 'precautions'
      ];
      
      const missingFields = requiredFields.filter(field => 
        !parsedFortune[field]
      );
      
      if (missingFields.length > 0) {
        console.warn('AI 응답에 필수 필드가 누락됨:', missingFields);
        // 기본 구조로 재구성
        parsedFortune = {
          overall_score: 0,
          wealth_fortune: '운세 예측 결과를 확인할 수 없습니다.',
          health_fortune: '운세 예측 결과를 확인할 수 없습니다.',
          love_fortune: '운세 예측 결과를 확인할 수 없습니다.',
          career_fortune: '운세 예측 결과를 확인할 수 없습니다.',
          luck_improvement: '운세 예측 결과를 확인할 수 없습니다.',
          precautions: '운세 예측 결과를 확인할 수 없습니다.'
        };
      }
      
    } catch (parseError) {
      console.error('JSON 파싱 오류:', parseError);
      console.log('원본 응답:', fortuneResult);

      return NextResponse.json(
        { 
            error: '운세 예측 중 오류가 발생했습니다.',
            details: fortuneResult
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      fortune: parsedFortune,
      image: publicUrl,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('운세 예측 API 오류:', error);
    
    return NextResponse.json(
      { 
        error: '운세 예측 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : '알 수 없는 오류'
      },
      { status: 500 }
    );
  }
}

// GET 요청 처리 (API 정보 제공)
export async function GET() {
  return NextResponse.json({
    message: '운세 예측 API',
    description: '이미지 파일을 업로드하여 AI 기반 운세 예측을 받을 수 있습니다.',
    usage: 'POST /api/fortune-prediction with multipart/form-data containing image file',
    requestFormat: {
      image: 'File (이미지 파일)'
    },
    features: [
      '이미지 자동 업로드 (Supabase Storage)',
      '전반적인 운세 점수 (0-100점)',
      '재물운 예측',
      '건강운 예측',
      '애정운/대인관계운 예측',
      '직업운/학업운 예측',
      '행운을 높이는 방법',
      '주의해야 할 점'
    ],
    responseFormat: {
      success: 'boolean',
      fortune: 'object (운세 예측 결과)',
      image: 'string (업로드된 이미지 URL)',
      timestamp: 'string (예측 완료 시간)'
    }
  });
}
