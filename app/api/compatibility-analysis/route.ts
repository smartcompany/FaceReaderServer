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
async function loadPrompt(language: string, platform?: string): Promise<string> {
  try {
    let promptFileName: string;
    let basePrompt: string;
    
    promptFileName = 'compatibility-analysis.txt';
    basePrompt = '당신은 전문적인 관상학자이자 궁합 분석 전문가입니다. 두 사람의 얼굴 사진을 분석하여 궁합을 분석해주세요.';
    
    const promptPath = join(process.cwd(), 'prompts', 'compatibility-analysis_wizard.txt');
    console.log('프롬프트 파일 경로:', promptPath);
    console.log('플랫폼:', platform);
    
    const promptContent = await readFile(promptPath, 'utf-8');
    console.log('프롬프트 내용:', promptContent);
    
    // 언어별 프롬프트 생성
    return getLanguageSpecificPrompt(promptContent, language);
  } catch (error) {
    console.error('프롬프트 파일 읽기 오류:', error);
    // 기본 프롬프트 반환
    const fallbackPrompt = '당신은 전문적인 분석가입니다. 두 사람의 얼굴 사진을 분석하여 관계를 분석해주세요.';
    return getLanguageSpecificPrompt(fallbackPrompt, language);
  }
}

export async function POST(request: NextRequest) {
  try {
    // 언어 정보 추출
    const language = getLanguageFromHeaders(request);
    console.log('요청 언어:', language);
    
    const formData = await request.formData();
    const image1File = formData.get('image1') as File | null;
    const image2File = formData.get('image2') as File | null;
    const image1Url = formData.get('image1Url') as string | null;
    const image2Url = formData.get('image2Url') as string | null;
    const platform = formData.get('platform') as string | null;
    
    console.log('요청 플랫폼:', platform);
    
    let publicUrl1: string;
    let publicUrl2: string;

    // URL이 제공된 경우 파일 업로드 건너뛰기
    if (image1Url && image2Url) {
      console.log('URL 모드로 궁합 분석 진행');
      console.log('이미지1 URL:', image1Url);
      console.log('이미지2 URL:', image2Url);
      
      publicUrl1 = image1Url;
      publicUrl2 = image2Url;
    } else if (image1File && image2File) {
      // 기존 파일 업로드 로직
      console.log('파일 업로드 모드로 궁합 분석 진행');
      console.log('업로드된 파일 1:', image1File.name, '크기:', image1File.size);
      console.log('업로드된 파일 2:', image2File.name, '크기:', image2File.size);

      // 첫 번째 이미지 파일을 버퍼로 변환
      const bytes1 = await image1File.arrayBuffer();
      const buffer1 = Buffer.from(bytes1);

      // 두 번째 이미지 파일을 버퍼로 변환
      const bytes2 = await image2File.arrayBuffer();
      const buffer2 = Buffer.from(bytes2);

      // Supabase Storage에 첫 번째 이미지 업로드
      const fileName1 = `compatibility-analysis/${Date.now()}-person1-${image1File.name}`;
      const { data: uploadData1, error: uploadError1 } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(fileName1, buffer1, {
          contentType: image1File.type,
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError1) {
        console.error('첫 번째 이미지 Supabase 업로드 오류:', uploadError1);
        return NextResponse.json(
          { error: '첫 번째 이미지 업로드 중 오류가 발생했습니다.' },
          { status: 500 }
        );
      }

      // Supabase Storage에 두 번째 이미지 업로드
      const fileName2 = `compatibility-analysis/${Date.now()}-person2-${image2File.name}`;
      const { data: uploadData2, error: uploadError2 } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(fileName2, buffer2, {
          contentType: image2File.type,
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError2) {
        console.error('두 번째 이미지 Supabase 업로드 오류:', uploadError2);
        return NextResponse.json(
          { error: '두 번째 이미지 업로드 중 오류가 발생했습니다.' },
          { status: 500 }
        );
      }

      // 공개 URL 생성
      const { data: { publicUrl: url1 } } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(fileName1);

      const { data: { publicUrl: url2 } } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(fileName2);

      publicUrl1 = url1;
      publicUrl2 = url2;

      console.log('첫 번째 이미지 Supabase 업로드 완료:', publicUrl1);
      console.log('두 번째 이미지 Supabase 업로드 완료:', publicUrl2);
    } else {
      return NextResponse.json(
        { error: '두 개의 이미지 파일(image1, image2) 또는 두 개의 이미지 URL(image1Url, image2Url)이 필요합니다.' },
        { status: 400 }
      );
    }

    // 프롬프트 로드
    const prompt = await loadPrompt(language, platform);
    
    // OpenAI API 호출 (두 이미지 모두 포함)
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
                url: publicUrl1
              }
            },
            {
              type: "image_url",
              image_url: {
                url: publicUrl2
              }
            }
          ]
        }
      ],
      response_format: {
        type: "json_object"
      },
    });

    const compatibilityResult = response.choices[0]?.message?.content;
    
    if (!compatibilityResult) {
      return NextResponse.json(
        { error: 'AI 궁합 분석 결과를 생성할 수 없습니다.' },
        { status: 500 }
      );
    }

    // JSON 응답 파싱 및 검증
    let parsedCompatibility;
    try {
      console.log('AI 원본 응답:', compatibilityResult);
      
      // JSON 코드 블록이 있는 경우 추출
      const jsonMatch = compatibilityResult.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonString = jsonMatch ? jsonMatch[1] : compatibilityResult;
      
      // JSON 문자열 정리 (불필요한 공백, 줄바꿈 제거)
      const cleanJsonString = jsonString.trim().replace(/\n/g, ' ').replace(/\r/g, '');
      
      console.log('정리된 JSON 문자열:', cleanJsonString);
      
      parsedCompatibility = JSON.parse(cleanJsonString);
      
      // 필수 필드 검증 (플랫폼별로 다르게)
      let requiredFields: string[];
      let defaultStructure: any;
      
      if (platform === 'ios') {
        // iOS: 새로운 필드들 체크
        requiredFields = [
          'overall_score', 'personality_alignment', 'emotional_dynamics',
          'social_interaction', 'communication_style', 'collaboration_potential',
          'growth_suggestions', 'cautions'
        ];
        
        defaultStructure = {
          overall_score: 0,
          personality_alignment: '분석 결과를 확인할 수 없습니다.',
          emotional_dynamics: '분석 결과를 확인할 수 없습니다.',
          social_interaction: '분석 결과를 확인할 수 없습니다.',
          communication_style: '분석 결과를 확인할 수 없습니다.',
          collaboration_potential: '분석 결과를 확인할 수 없습니다.',
          growth_suggestions: '분석 결과를 확인할 수 없습니다.',
          cautions: '분석 결과를 확인할 수 없습니다.'
        };
      } else {
        // Android: 기존 필드들 체크
        requiredFields = [
          'overall_score', 'personality_compatibility', 'emotional_compatibility',
          'social_compatibility', 'communication_compatibility', 'long_term_prospects',
          'improvement_suggestions', 'precautions'
        ];
        
        defaultStructure = {
          overall_score: 0,
          personality_compatibility: '분석 결과를 확인할 수 없습니다.',
          emotional_compatibility: '분석 결과를 확인할 수 없습니다.',
          social_compatibility: '분석 결과를 확인할 수 없습니다.',
          communication_compatibility: '분석 결과를 확인할 수 없습니다.',
          long_term_prospects: '분석 결과를 확인할 수 없습니다.',
          improvement_suggestions: '분석 결과를 확인할 수 없습니다.',
          precautions: '분석 결과를 확인할 수 없습니다.'
        };
      }
      
      const missingFields = requiredFields.filter(field => 
        !parsedCompatibility[field]
      );
      
      if (missingFields.length > 0) {
        console.warn('AI 응답에 필수 필드가 누락됨:', missingFields);
        console.log('플랫폼:', platform);
        // 기본 구조로 재구성
        parsedCompatibility = defaultStructure;
      }
      
    } catch (parseError) {
      console.error('JSON 파싱 오류:', parseError);
      console.log('원본 응답:', compatibilityResult);

      return NextResponse.json(
        { 
            error: '궁합 분석 중 오류가 발생했습니다.',
            details: compatibilityResult
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      compatibility: parsedCompatibility,
      images: {
        person1: publicUrl1,
        person2: publicUrl2
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('궁합 분석 API 오류:', error);
    
    return NextResponse.json(
      { 
        error: '궁합 분석 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : '알 수 없는 오류'
      },
      { status: 500 }
    );
  }
}

// GET 요청 처리 (API 정보 제공)
export async function GET() {
  return NextResponse.json({
    message: '궁합 분석 API',
    description: '두 사람의 이미지 파일을 업로드하여 AI 기반 궁합 분석을 받을 수 있습니다.',
    usage: 'POST /api/compatibility-analysis with multipart/form-data containing image1 and image2 files',
    requestFormat: {
      image1: 'File (첫 번째 사람의 이미지 파일)',
      image2: 'File (두 번째 사람의 이미지 파일)'
    },
    features: [
      '두 이미지 자동 업로드 (Supabase Storage)',
      '전반적인 궁합 점수 (0-100점)',
      '성격적 궁합 분석',
      '감정적 궁합 분석',
      '대인관계 궁합 분석',
      '커뮤니케이션 궁합 분석',
      '장기적 관계 전망',
      '궁합 개선 방안',
      '주의사항 및 갈등 해결 방안'
    ],
    responseFormat: {
      success: 'boolean',
      compatibility: 'object (궁합 분석 결과)',
      images: 'object (업로드된 이미지 URL)',
      timestamp: 'string (분석 완료 시간)'
    }
  });
}
