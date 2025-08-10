import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 성격 분석을 위한 AI 프롬프트
const PERSONALITY_ANALYSIS_PROMPT = `당신은 전문적인 관상학자이자 성격 분석 전문가입니다. 
사용자가 제공한 얼굴 사진을 분석하여 다음과 같은 내용을 한국어로 상세하게 분석해주세요:

## 분석 요청 사항:
1. **성격 특성과 기질**: 얼굴의 특징을 바탕으로 한 성격의 주요 특성
2. **강점과 약점**: 개인의 장점과 개선 가능한 부분
3. **대인관계 스타일**: 소통 방식과 인간관계에서의 특징
4. **개발 방향**: 개인적 성장을 위한 제안사항
5. **매력 포인트**: 개인의 고유한 매력과 특징

## 분석 가이드라인:
- 과학적 근거와 전통적 관상학을 조합하여 분석
- 긍정적이고 건설적인 톤으로 작성
- 구체적이고 실용적인 조언 제공
- 개인정보 보호를 위한 일반적인 분석 제공
- 각 항목별로 2-3문장으로 상세 설명

## 응답 형식:
분석 결과를 다음 형식으로 구조화하여 제공해주세요:

### 🎭 성격 특성과 기질
[분석 내용]

### 💪 강점과 약점
[분석 내용]

### 🤝 대인관계 스타일
[분석 내용]

### 🌱 발전 방향
[분석 내용]

### ✨ 매력 포인트
[분석 내용]

### 💡 종합 조언
[전체적인 성격과 개선 방향에 대한 종합적인 조언]

사용자의 얼굴 사진을 분석하여 위의 형식에 맞춰 상세하고 유용한 성격 분석 결과를 제공해주세요.`;

export async function POST(request: NextRequest) {
  try {
    // 요청에서 이미지 파일 추출
    const formData = await request.formData();
    const imageFile = formData.get('image') as File;
    
    if (!imageFile) {
      return NextResponse.json(
        { error: '이미지 파일이 필요합니다.' },
        { status: 400 }
      );
    }

    // 이미지 파일을 임시 디렉토리에 저장
    const bytes = await imageFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // 임시 디렉토리 생성
    const tempDir = join(process.cwd(), 'temp');
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true });
    }
    
    const tempFilePath = join(tempDir, `analysis_${Date.now()}.jpg`);
    await writeFile(tempFilePath, buffer);

    // OpenAI API 호출
    const response = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: PERSONALITY_ANALYSIS_PROMPT
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${imageFile.type};base64,${buffer.toString('base64')}`
              }
            }
          ]
        }
      ],
      max_tokens: 2000,
      temperature: 0.7,
    });

    // 임시 파일 삭제
    try {
      await writeFile(tempFilePath, ''); // 파일 내용 비우기
    } catch (error) {
      console.log('임시 파일 정리 중 오류:', error);
    }

    const analysisResult = response.choices[0]?.message?.content;
    
    if (!analysisResult) {
      return NextResponse.json(
        { error: 'AI 분석 결과를 생성할 수 없습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      analysis: analysisResult,
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
    description: '이미지를 업로드하여 AI 기반 성격 분석을 받을 수 있습니다.',
    usage: 'POST /api/personality-analysis with image file in form-data',
    features: [
      '성격 특성과 기질 분석',
      '강점과 약점 파악',
      '대인관계 스타일 분석',
      '개발 방향 제안',
      '매력 포인트 분석'
    ]
  });
}
