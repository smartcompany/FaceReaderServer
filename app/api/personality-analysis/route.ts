import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 프롬프트 파일 읽기 함수
async function loadPrompt(): Promise<string> {
  try {
    const promptPath = join(process.cwd(), 'prompts', 'personality-analysis.txt');
    const promptContent = await readFile(promptPath, 'utf-8');
    return promptContent;
  } catch (error) {
    console.error('프롬프트 파일 읽기 오류:', error);
    // 기본 프롬프트 반환
    return '당신은 전문적인 관상학자이자 성격 분석 전문가입니다. 사용자가 제공한 얼굴 사진을 분석하여 성격 특성, 강점과 약점, 대인관계 스타일, 발전 방향, 매력 포인트를 한국어로 분석해주세요.';
  }
}

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
    await writeFile(tempFilePath, new Uint8Array(bytes));

    // 프롬프트 로드
    const prompt = await loadPrompt();
    
    // OpenAI API 호출
    const response = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
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
