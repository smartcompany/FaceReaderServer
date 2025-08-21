import { NextRequest } from 'next/server';

// 언어 코드를 추출하는 헬퍼 함수
export function getLanguageFromHeaders(request: NextRequest): string {
  // X-Language 헤더를 우선 확인
  const customLanguage = request.headers.get('X-Language');
  if (customLanguage) {
    return customLanguage;
  }

  // Accept-Language 헤더 확인
  const acceptLanguage = request.headers.get('Accept-Language');
  if (acceptLanguage) {
    // Accept-Language 형식: "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7"
    const languages = acceptLanguage.split(',').map(lang => {
      const [language] = lang.split(';');
      return language.trim();
    });
    
    // 지원하는 언어 중 첫 번째를 반환
    for (const lang of languages) {
      const langCode = lang.split('-')[0]; // "ko-KR" -> "ko"
      if (['ko', 'en', 'ja', 'zh'].includes(langCode)) {
        return langCode;
      }
    }
  }

  // 기본값으로 한국어 반환
  return 'ko';
}

// OpenAI API 요청 시 언어별 프롬프트를 생성하는 헬퍼 함수
export function getLanguageSpecificPrompt(basePrompt: string, language: string): string {
  const languageInstructions = {
    ko: '응답은 반드시 한국어로 작성해주세요.',
    en: 'Please respond in English.',
    ja: '日本語で回答してください。',
    zh: '请用中文回答。'
  };

  const instruction = languageInstructions[language as keyof typeof languageInstructions] || languageInstructions.ko;
  
  return `${basePrompt}\n\n${instruction}`;
}

// 언어별 응답 메시지를 생성하는 헬퍼 함수
export function getLanguageSpecificMessage(key: string, language: string): string {
  const messages = {
    success: {
      ko: '성공적으로 처리되었습니다.',
      en: 'Successfully processed.',
      ja: '正常に処理されました。',
      zh: '处理成功。'
    },
    error: {
      ko: '오류가 발생했습니다.',
      en: 'An error occurred.',
      ja: 'エラーが発生しました。',
      zh: '发生错误。'
    },
    invalidRequest: {
      ko: '잘못된 요청입니다.',
      en: 'Invalid request.',
      ja: '無効なリクエストです。',
      zh: '无效请求。'
    }
  };

  const languageMessages = messages[key as keyof typeof messages];
  if (languageMessages) {
    return languageMessages[language as keyof typeof languageMessages] || languageMessages.ko;
  }

  return messages.success.ko; // 기본값
}

// OpenAI 공통 설정
export const openAIConfig = {
  model: "gpt-5-mini",
  max_completion_tokens: 2000,
};
