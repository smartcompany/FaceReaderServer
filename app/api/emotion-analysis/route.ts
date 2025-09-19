import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { getLanguageFromHeaders, getLanguageSpecificPrompt, openAIConfig } from '../_helpers';
import { shouldUseDummyData, loadDummyData } from '../../../utils/dummy-settings';

const STORAGE_BUCKET = "face-reader";

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 환경 변수 설정
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY;

// 환경 변수 검증
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ [Emotion] 환경 변수가 설정되지 않음:', {
    SUPABASE_URL: SUPABASE_URL ? '설정됨' : '설정되지 않음',
    SUPABASE_KEY: SUPABASE_KEY ? '설정됨' : '설정되지 않음'
  });
}

// Supabase 클라이언트 초기화
const supabase = createClient(SUPABASE_URL || '', SUPABASE_KEY || '');

// 프롬프트 파일 읽기 함수 (Supabase에서 읽기)
async function loadPrompt(language: string): Promise<string> {
  try {
    const promptFileName = 'emotion-analysis.txt';
    
    console.log('Supabase에서 프롬프트 파일 읽기:', promptFileName);
    
    // Supabase Storage에서 프롬프트 파일 읽기
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(`prompts/${promptFileName}`);
    
    if (error) {
      console.error('Supabase 프롬프트 파일 읽기 오류:', error);
      throw new Error(`프롬프트 파일을 찾을 수 없습니다: ${promptFileName}`);
    }
    
    const promptContent = await data.text();
    console.log('프롬프트 내용:', promptContent);
    
    // 언어별 프롬프트 생성
    return getLanguageSpecificPrompt(promptContent, language);
  } catch (error) {
    console.error('프롬프트 파일 읽기 오류:', error);
    // 기본 프롬프트 반환
    const fallbackPrompt = '당신은 전문적인 감정 분석가입니다. 사진에서 감정 상태를 분석해주세요.';
    return getLanguageSpecificPrompt(fallbackPrompt, language);
  }
}

export async function POST(request: NextRequest) {
  try {
    // 더미 데이터 사용 여부 확인
    const useDummy = await shouldUseDummyData();
    if (useDummy) {
      console.log('더미 데이터 모드로 표정 분석 실행');
      const dummyData = await loadDummyData('emotion-analysis.json');
      return NextResponse.json(dummyData);
    }

    const formData = await request.formData();
    const image = formData.get('image') as File;
    const language = getLanguageFromHeaders(request);

    if (!image) {
      return NextResponse.json(
        { success: false, error: '이미지가 제공되지 않았습니다.' },
        { status: 400 }
      );
    }

    console.log('✅ [Emotion] 표정 분석 요청 수신');
    console.log('📄 [Emotion] 이미지 파일명:', image.name);
    console.log('📏 [Emotion] 이미지 크기:', image.size);
    console.log('🌍 [Emotion] 언어:', language);

    // 이미지를 base64로 변환
    const bytes = await image.arrayBuffer();
    const base64Image = Buffer.from(bytes).toString('base64');

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
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ]
        }
      ]
    });

    const result = response.choices[0]?.message?.content;
    
    if (!result) {
      throw new Error('OpenAI 응답이 비어있습니다.');
    }

    console.log('✅ [Emotion] OpenAI 응답 수신');
    console.log('📝 [Emotion] 원본 응답:', result);

    // JSON 파싱
    let emotionData;
    try {
      // 응답에서 JSON 부분만 추출
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        emotionData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('JSON 형식을 찾을 수 없습니다.');
      }
    } catch (parseError) {
      console.error('❌ [Emotion] JSON 파싱 실패:', parseError);
      console.error('❌ [Emotion] 원본 응답:', result);
      return NextResponse.json(
        { success: false, error: 'AI 응답 파싱에 실패했습니다.' },
        { status: 500 }
      );
    }

    console.log('✅ [Emotion] 표정 분석 완료');
    console.log('📊 [Emotion] 분석 결과:', emotionData);

    return NextResponse.json({
      success: true,
      data: emotionData
    });

  } catch (error) {
    console.error('❌ [Emotion] 표정 분석 실패:', error);
    return NextResponse.json(
      { success: false, error: '표정 분석 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
