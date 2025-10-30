import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import personalityPrompt from './personality-analysis.txt';
import { getLanguageFromHeaders, getLanguageSpecificPrompt, openAIConfig } from '../_helpers';
import { shouldUseDummyData, loadDummyData } from '../../../utils/dummy-settings';
import convert from 'heic-convert';

// HEIC 파일인지 확인하는 함수
function isHEICBuffer(buffer: Buffer): boolean {
  const signature = buffer.toString('ascii', 4, 12);
  return signature.includes('heic') || signature.includes('mif1');
}

// HEIC를 JPEG로 변환하는 함수
async function convertHEICToJPEG(buffer: Buffer): Promise<Buffer> {
  try {
    console.log('🔄 HEIC 파일 감지, JPEG로 변환 중...');
    const outputBuffer = await convert({
      buffer: buffer,
      format: 'JPEG',
      quality: 0.9
    });
    console.log('✅ HEIC → JPEG 변환 완료');
    return Buffer.from(outputBuffer);
  } catch (error) {
    console.error('❌ HEIC 변환 실패:', error);
    throw new Error('HEIC 파일 변환에 실패했습니다.');
  }
}

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 환경 변수 설정
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY!;

// Supabase 클라이언트 초기화
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 프롬프트 파일 로드(로컬 import)
async function loadPrompt(language: string): Promise<string> {
  try {
    return getLanguageSpecificPrompt(personalityPrompt as unknown as string, language);
  } catch (error) {
    console.error('프롬프트 파일 읽기 오류:', error);
    const fallback = '당신은 이미지 기반 캐릭터 성격 분석가입니다. 외형적 분위기를 바탕으로 가상의 캐릭터 성격을 창작적으로 분석하고 JSON으로만 답하세요.';
    return getLanguageSpecificPrompt(fallback, language);
  }
}

export async function POST(request: NextRequest) {
  try {
    // 더미 데이터 사용 여부 확인
    const useDummy = await shouldUseDummyData();
    if (useDummy) {
      console.log('더미 데이터 모드로 성격 분석 실행');
      const dummyData = await loadDummyData('personality-analysis.json');
      return NextResponse.json(dummyData);
    }

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
    let buffer = Buffer.from(bytes);
    let contentType = imageFile.type;
    let fileExt = imageFile.name.split('.').pop();

    // HEIC 파일인지 확인하고 변환
    if (isHEICBuffer(buffer)) {
      console.log('📸 HEIC 파일 감지됨, JPEG로 변환 시작');
      buffer = await convertHEICToJPEG(buffer);
      contentType = 'image/jpeg';
      fileExt = 'jpg';
    }

    // Supabase Storage에 업로드
    const fileName = `personality-analysis/${Date.now()}.${fileExt}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('face-reader')
      .upload(fileName, buffer, {
        contentType: contentType,
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
