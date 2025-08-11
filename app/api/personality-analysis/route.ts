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

    // JSON 응답 파싱 및 검증
    let parsedAnalysis;
    try {
      // JSON 코드 블록이 있는 경우 추출
      const jsonMatch = analysisResult.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonString = jsonMatch ? jsonMatch[1] : analysisResult;
      
      parsedAnalysis = JSON.parse(jsonString);
      
      // 필수 필드 검증
      const requiredFields = [
        'personality_traits', 'strengths_weaknesses', 'communication_style',
        'growth_direction', 'charm_points', 'overall_advice'
      ];
      
      const missingFields = requiredFields.filter(field => 
        !parsedAnalysis[field] || !parsedAnalysis[field].title || !parsedAnalysis[field].content
      );
      
      if (missingFields.length > 0) {
        console.warn('AI 응답에 필수 필드가 누락됨:', missingFields);
        // 기본 구조로 재구성
        parsedAnalysis = {
          personality_traits: { title: '🎭 성격 특성과 기질', content: '분석 결과를 확인할 수 없습니다.' },
          strengths_weaknesses: { title: '💪 강점과 약점', content: '분석 결과를 확인할 수 없습니다.' },
          communication_style: { title: '🤝 대인관계 스타일', content: '분석 결과를 확인할 수 없습니다.' },
          growth_direction: { title: '🌱 발전 방향', content: '분석 결과를 확인할 수 없습니다.' },
          charm_points: { title: '✨ 매력 포인트', content: '분석 결과를 확인할 수 없습니다.' },
          overall_advice: { title: '💡 종합 조언', content: '분석 결과를 확인할 수 없습니다.' }
        };
      }
      
    } catch (parseError) {
      console.error('JSON 파싱 오류:', parseError);
      console.log('원본 응답:', analysisResult);
      
      // 파싱 실패 시 기본 구조 반환
      parsedAnalysis = {
        personality_traits: { title: '🎭 성격 특성과 기질', content: 'AI 분석 결과를 파싱할 수 없습니다.' },
        strengths_weaknesses: { title: '💪 강점과 약점', content: 'AI 분석 결과를 파싱할 수 없습니다.' },
        communication_style: { title: '🤝 대인관계 스타일', content: 'AI 분석 결과를 파싱할 수 없습니다.' },
        growth_direction: { title: '🌱 발전 방향', content: 'AI 분석 결과를 파싱할 수 없습니다.' },
        charm_points: { title: '✨ 매력 포인트', content: 'AI 분석 결과를 파싱할 수 없습니다.' },
        overall_advice: { title: '💡 종합 조언', content: 'AI 분석 결과를 파싱할 수 없습니다.' }
      };
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
