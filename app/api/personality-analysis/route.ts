import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import { getLanguageFromHeaders, getLanguageSpecificPrompt } from '../_helpers';
 
const STORAGE_BUCKET = "rate-history";

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
    const promptPath = join(process.cwd(), 'prompts', 'personality-analysis.txt');
    console.log('프롬프트 파일 경로:', promptPath);
    
    const promptContent = await readFile(promptPath, 'utf-8');
    console.log('프롬프트 내용:', promptContent);
    
    // 언어별 프롬프트 생성
    return getLanguageSpecificPrompt(promptContent, language);
  } catch (error) {
    console.error('프롬프트 파일 읽기 오류:', error);
    // 기본 프롬프트 반환
    const basePrompt = '당신은 전문적인 관상학자이자 성격 분석 전문가입니다. 사용자가 제공한 얼굴 사진을 분석하여 성격 특성, 강점과 약점, 대인관계 스타일, 발전 방향, 매력 포인트를 분석해주세요.';
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
    const fileName = `personality-analysis/${Date.now()}-${imageFile.name}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('face-reader')
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
      .from('face-reader')
      .getPublicUrl(fileName);

    console.log('Supabase 업로드 완료:', publicUrl);

    // 프롬프트 로드
    const prompt = await loadPrompt(language);
    
    // OpenAI API 호출
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
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
      max_tokens: 2000,
      temperature: 0.7,
    });

    const analysisResult = response.choices[0]?.message?.content;
    
    if (!analysisResult) {
      return NextResponse.json(
        { error: 'AI 분석 결과를 생성할 수 없습니다.' },
        { status: 500 }
      );
    }

    // JSON 응답 파싱 및 검증
    let parsedAnalysis;
    try {
      console.log('AI 원본 응답:', analysisResult);
      
      // JSON 코드 블록이 있는 경우 추출
      const jsonMatch = analysisResult.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonString = jsonMatch ? jsonMatch[1] : analysisResult;
      
      // JSON 문자열 정리 (불필요한 공백, 줄바꿈 제거)
      const cleanJsonString = jsonString.trim().replace(/\n/g, ' ').replace(/\r/g, '');
      
      console.log('정리된 JSON 문자열:', cleanJsonString);
      
      parsedAnalysis = JSON.parse(cleanJsonString);
      
      // 필수 필드 검증 (단순 문자열 형태)
      const requiredFields = [
        'personality_traits', 'strengths_weaknesses', 'communication_style',
        'growth_direction', 'charm_points', 'overall_advice'
      ];
      
      const missingFields = requiredFields.filter(field => 
        !parsedAnalysis[field] || typeof parsedAnalysis[field] !== 'string'
      );
      
      if (missingFields.length > 0) {
        console.warn('AI 응답에 필수 필드가 누락됨:', missingFields);
        // 기본 구조로 재구성 (단순 문자열 형태)
        parsedAnalysis = {
          personality_traits: '분석 결과를 확인할 수 없습니다.',
          strengths_weaknesses: '분석 결과를 확인할 수 없습니다.',
          communication_style: '분석 결과를 확인할 수 없습니다.',
          growth_direction: '분석 결과를 확인할 수 없습니다.',
          charm_points: '분석 결과를 확인할 수 없습니다.',
          overall_advice: '분석 결과를 확인할 수 없습니다.'
        };
      }
      
    } catch (parseError) {
      console.error('JSON 파싱 오류:', parseError);
      console.log('원본 응답:', analysisResult);

      return NextResponse.json(
        { 
            error: '성격 분석 중 오류가 발생했습니다.',
            details: analysisResult
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      analysis: parsedAnalysis,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('성격 분석 API 오류:', error);
    
    return NextResponse.json(
      { 
        error: '성격 분석 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : '알 수 없는 오류'
      },
      { status: 500 }
    );
  }
}

// GET 요청 처리 (API 정보 제공)
export async function GET() {
  return NextResponse.json({
    message: '성격 분석 API',
    description: '이미지 파일을 업로드하여 AI 기반 성격 분석을 받을 수 있습니다.',
    usage: 'POST /api/personality-analysis with multipart/form-data containing image file',
    requestFormat: {
      image: 'File (이미지 파일)'
    },
    features: [
      '이미지 자동 업로드 (Supabase Storage)',
      '성격 특성과 기질 분석',
      '강점과 약점 파악',
      '대인관계 스타일 분석',
      '개발 방향 제안',
      '매력 포인트 분석'
    ]
  });
}
