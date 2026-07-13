import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import emotionPrompt from './emotion-analysis.txt';
import { getLanguageFromHeaders, getLanguageSpecificPrompt } from '../_helpers';
import { ai } from '../../../lib/ai-client';
import { shouldUseDummyData, loadDummyData } from '../../../utils/dummy-settings';
import convert from 'heic-convert';

const STORAGE_BUCKET = "face-reader";

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

// 프롬프트 로드(로컬 import)
async function loadPrompt(language: string): Promise<string> {
  try {
    return getLanguageSpecificPrompt(emotionPrompt as unknown as string, language);
  } catch (error) {
    console.error('프롬프트 파일 읽기 오류:', error);
    const fallbackPrompt = '당신은 따뜻한 감정 피드백 상담사입니다. 사진의 표정·분위기에서 느껴지는 감정을 공감적으로 해석하고, 자기이해에 도움이 되는 조언을 JSON으로만 답하세요. 진단하지 마세요.';
    return getLanguageSpecificPrompt(fallbackPrompt, language);
  }
}

export async function POST(request: NextRequest) {
  try {
    // 더미 데이터 사용 여부 확인
    const useDummy = await shouldUseDummyData();
    if (useDummy) {
      console.log('더미 데이터 모드로 감정 분석 실행');
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

    console.log('✅ [Emotion] 감정 분석 요청 수신');
    console.log('📄 [Emotion] 이미지 파일명:', image.name);
    console.log('📏 [Emotion] 이미지 크기:', image.size);
    console.log('🌍 [Emotion] 언어:', language);

    // 이미지를 base64로 변환
    const bytes = await image.arrayBuffer();
    let buffer = Buffer.from(bytes);
    let contentType = image.type;

    // HEIC 파일인지 확인하고 변환
    if (isHEICBuffer(buffer)) {
      console.log('📸 HEIC 파일 감지됨, JPEG로 변환 시작');
      buffer = await convertHEICToJPEG(buffer);
      contentType = 'image/jpeg';
    }

    const base64Image = buffer.toString('base64');

    // 프롬프트 로드
    const prompt = await loadPrompt(language);

    // gpt-5-mini default(2000)는 reasoning에 토큰을 다 써 본문이 비는 경우가 있음
    // → 궁합과 동일하게 long_output 사용
    const mimeType = contentType?.startsWith('image/')
      ? contentType
      : 'image/jpeg';
    const response = await ai.createChatCompletion({
      preset: 'long_output',
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
                url: `data:${mimeType};base64,${base64Image}`,
                detail: 'low',
              }
            }
          ]
        }
      ]
    });

    const choice = response.choices[0];
    const result =
      typeof choice?.message?.content === 'string'
        ? choice.message.content
        : null;

    if (!result?.trim()) {
      console.error('❌ [Emotion] 빈 응답', {
        finish_reason: choice?.finish_reason,
        usage: response.usage,
        messageKeys: choice?.message ? Object.keys(choice.message) : [],
      });
      throw new Error(
        `OpenAI 응답이 비어있습니다. (finish_reason=${choice?.finish_reason ?? 'unknown'})`
      );
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

    console.log('✅ [Emotion] 감정 분석 완료');
    console.log('📊 [Emotion] 분석 결과:', emotionData);

    return NextResponse.json({
      success: true,
      data: emotionData
    });

  } catch (error) {
    console.error('❌ [Emotion] 감정 분석 실패:', error);
    const message =
      error instanceof Error ? error.message : '감정 분석 중 오류가 발생했습니다.';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
