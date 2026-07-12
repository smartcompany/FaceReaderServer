import { NextRequest } from 'next/server';

const SUPPORTED_LANGUAGES = ['ko', 'en', 'ja', 'zh'] as const;
type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** `en_US` / `en-US` / `EN` → `en` */
export function normalizeLanguageCode(language: string): SupportedLanguage {
  const code = language.trim().toLowerCase().split(/[-_]/)[0] ?? '';
  if ((SUPPORTED_LANGUAGES as readonly string[]).includes(code)) {
    return code as SupportedLanguage;
  }
  return 'ko';
}

// 언어 코드를 추출하는 헬퍼 함수
export function getLanguageFromHeaders(request: NextRequest): string {
  // X-Language 헤더를 우선 확인
  const customLanguage = request.headers.get('X-Language');
  if (customLanguage) {
    return normalizeLanguageCode(customLanguage);
  }

  // Accept-Language 헤더 확인
  const acceptLanguage = request.headers.get('Accept-Language');
  if (acceptLanguage) {
    // Accept-Language 형식: "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7"
    const languages = acceptLanguage.split(',').map((lang) => {
      const [language] = lang.split(';');
      return language.trim();
    });

    for (const lang of languages) {
      const raw = lang.split(/[-_]/)[0]?.toLowerCase() ?? '';
      if ((SUPPORTED_LANGUAGES as readonly string[]).includes(raw)) {
        return raw;
      }
    }
  }

  // 기본값으로 한국어 반환
  return 'ko';
}

/**
 * 프롬프트 본문이 한국어여도, 출력 언어를 강제합니다.
 * 지시문을 앞·뒤에 두어 모델이 템플릿 언어를 따라가지 않게 합니다.
 */
export function getLanguageSpecificPrompt(basePrompt: string, language: string): string {
  const lang = normalizeLanguageCode(language);

  const languageInstructions: Record<SupportedLanguage, string> = {
    ko: [
      '## 출력 언어 (필수)',
      '- JSON의 모든 사용자용 텍스트 필드는 반드시 한국어로 작성하세요.',
      '- 필드명(key)은 예시 JSON과 동일하게 유지하세요.',
    ].join('\n'),
    en: [
      '## OUTPUT LANGUAGE (MANDATORY)',
      '- Write ALL user-facing text values in the JSON response in English only.',
      '- Do NOT use Korean, Japanese, or Chinese in any text field.',
      '- The prompt template may be written in Korean for structure/examples only — ignore that language for your output.',
      '- Keep JSON keys exactly as shown; only the string values must be English.',
      '- Labels like score descriptions inside strings must also be English (e.g. "Good match", not "좋은 궁합").',
    ].join('\n'),
    ja: [
      '## 出力言語（必須）',
      '- JSONのユーザー向けテキスト値はすべて日本語で書いてください。',
      '- 韓国語・英語・中国語で書かないでください。',
      '- プロンプト本文が韓国語でも、出力言語は日本語にしてください。',
      '- JSONのキー名は例のまま維持し、値だけ日本語にしてください。',
    ].join('\n'),
    zh: [
      '## 输出语言（必须）',
      '- JSON 中所有面向用户的文本字段必须使用中文。',
      '- 不要使用韩语、英语或日语。',
      '- 即使提示模板是韩语，输出也必须是中文。',
      '- JSON 的键名保持与示例一致，仅将值写成中文。',
    ].join('\n'),
  };

  const instruction = languageInstructions[lang];

  return `${instruction}\n\n${basePrompt}\n\n${instruction}`;
}

// 언어별 응답 메시지를 생성하는 헬퍼 함수
export function getLanguageSpecificMessage(key: string, language: string): string {
  const lang = normalizeLanguageCode(language);
  const messages = {
    success: {
      ko: '성공적으로 처리되었습니다.',
      en: 'Successfully processed.',
      ja: '正常に処理されました。',
      zh: '处理成功。',
    },
    error: {
      ko: '오류가 발생했습니다.',
      en: 'An error occurred.',
      ja: 'エラーが発生しました。',
      zh: '发生错误。',
    },
    invalidRequest: {
      ko: '잘못된 요청입니다.',
      en: 'Invalid request.',
      ja: '無効なリクエストです。',
      zh: '无效请求。',
    },
  };

  const languageMessages = messages[key as keyof typeof messages];
  if (languageMessages) {
    return languageMessages[lang] || languageMessages.ko;
  }

  return messages.success.ko;
}
