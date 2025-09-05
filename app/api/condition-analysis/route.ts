import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import { getLanguageFromHeaders, getLanguageSpecificPrompt, openAIConfig } from '../_helpers';
 
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
    const promptPath = join(process.cwd(), 'prompts', 'condition-analysis.txt');
    console.log('프롬프트 파일 경로:', promptPath);
    
    const promptContent = await readFile(promptPath, 'utf-8');
    console.log('프롬프트 내용:', promptContent);
    
    // 언어별 프롬프트 생성
    return getLanguageSpecificPrompt(promptContent, language);
  } catch (error) {
    console.error('프롬프트 파일 읽기 오류:', error);
    throw new Error('컨디션 분석 프롬프트 파일을 읽을 수 없습니다.');
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
    const fileName = `condition-analysis/${Date.now()}-${imageFile.name}`;
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
      
      // 필수 필드 검증
      const requiredFields = [
        'energy_score', 'energy_comment', 'mood', 'focus_level', 
        'efficiency', 'care_tips', 'recommended_activities'
      ];
      
      const missingFields = requiredFields.filter(field => 
        !parsedAnalysis[field] || 
        (field === 'energy_score' && (typeof parsedAnalysis[field] !== 'number' || parsedAnalysis[field] < 0 || parsedAnalysis[field] > 100)) ||
        (field === 'care_tips' && !Array.isArray(parsedAnalysis[field])) ||
        (field === 'recommended_activities' && !Array.isArray(parsedAnalysis[field])) ||
        (field !== 'energy_score' && field !== 'care_tips' && field !== 'recommended_activities' && typeof parsedAnalysis[field] !== 'string')
      );
      
      if (missingFields.length > 0) {
        console.warn('AI 응답에 필수 필드가 누락됨:', missingFields);
        // 기본 구조로 재구성
        parsedAnalysis = {
          energy_score: 75,
          energy_comment: '오늘은 컨디션이 좋은 날이에요',
          mood: '기분이 밝고 긍정적이에요',
          focus_level: '집중력이 좋아 효율적으로 일할 수 있어요',
          efficiency: '업무나 공부에 몰입하기 좋은 상태입니다',
          care_tips: [
            '물을 충분히 마셔주세요',
            '잠깐 스트레칭이 도움이 됩니다',
            '충분한 휴식을 취해주세요'
          ],
          recommended_activities: [
            '산책하기 좋아요',
            '가벼운 운동이 컨디션 회복에 도움 됩니다',
            '독서나 명상이 좋겠어요'
          ]
        };
      }
      
    } catch (parseError) {
      console.error('JSON 파싱 오류:', parseError);
      console.log('원본 응답:', analysisResult);

      return NextResponse.json(
        { 
            error: '컨디션 분석 중 오류가 발생했습니다.',
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
    console.error('컨디션 분석 API 오류:', error);
    
    return NextResponse.json(
      { 
        error: '컨디션 분석 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : '알 수 없는 오류'
      },
      { status: 500 }
    );
  }
}

// GET 요청 처리 (API 정보 제공)
export async function GET() {
  return NextResponse.json({
    message: '컨디션 분석 API',
    description: '이미지 파일을 업로드하여 AI 기반 컨디션 분석을 받을 수 있습니다.',
    usage: 'POST /api/condition-analysis with multipart/form-data containing image file',
    requestFormat: {
      image: 'File (이미지 파일)'
    },
    features: [
      '이미지 자동 업로드 (Supabase Storage)',
      '에너지 지수 분석 (0-100점)',
      '기분 & 안정감 평가',
      '집중력 & 효율 분석',
      '오늘의 케어 팁 제공',
      '추천 활동 제안'
    ]
  });
}
