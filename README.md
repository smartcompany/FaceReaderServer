# 성격 분석 API 서버

AI 기반 얼굴 사진 분석을 통한 성격 분석 서비스입니다.

## 🚀 기능

- **AI 기반 성격 분석**: ChatGPT Vision API를 활용한 얼굴 사진 분석
- **구조화된 분석 결과**: 성격 특성, 강점/약점, 대인관계 스타일 등
- **개인정보 보호**: 업로드된 이미지는 분석 후 즉시 삭제
- **RESTful API**: 표준 HTTP 메서드를 사용한 API 설계

## 📋 분석 내용

1. **🎭 성격 특성과 기질**: 얼굴의 특징을 바탕으로 한 성격의 주요 특성
2. **💪 강점과 약점**: 개인의 장점과 개선 가능한 부분
3. **🤝 대인관계 스타일**: 소통 방식과 인간관계에서의 특징
4. **🌱 발전 방향**: 개인적 성장을 위한 제안사항
5. **✨ 매력 포인트**: 개인의 고유한 매력과 특징
6. **💡 종합 조언**: 전체적인 성격과 개선 방향에 대한 종합적인 조언

## 🛠️ 설치 및 설정

### 1. 의존성 설치
```bash
npm install
```

### 2. 환경 변수 설정
프로젝트 루트에 `.env.local` 파일을 생성하고 다음 내용을 추가하세요:

```env
# OpenAI API 설정
OPENAI_API_KEY=your_openai_api_key_here

# 서버 설정
NODE_ENV=development
```

**OpenAI API 키 발급 방법:**
1. [OpenAI Platform](https://platform.openai.com/)에 가입
2. API Keys 섹션에서 새 키 생성
3. 생성된 키를 `OPENAI_API_KEY`에 설정

### 3. 개발 서버 실행
```bash
npm run dev
```

서버는 `http://localhost:3000`에서 실행됩니다.

## 📡 API 사용법

### 성격 분석 API

**엔드포인트:** `POST /api/personality-analysis`

**요청:**
- Content-Type: `multipart/form-data`
- Body: `image` 필드에 이미지 파일 포함

**응답:**
```json
{
  "success": true,
  "analysis": "분석 결과 텍스트...",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**에러 응답:**
```json
{
  "error": "에러 메시지",
  "details": "상세 에러 정보"
}
```

### API 정보 조회

**엔드포인트:** `GET /api/personality-analysis`

**응답:**
```json
{
  "message": "성격 분석 API",
  "description": "이미지를 업로드하여 AI 기반 성격 분석을 받을 수 있습니다.",
  "usage": "POST /api/personality-analysis with image file in form-data",
  "features": [
    "성격 특성과 기질 분석",
    "강점과 약점 파악",
    "대인관계 스타일 분석",
    "개발 방향 제안",
    "매력 포인트 분석"
  ]
}
```

## 🧪 테스트

### 웹 인터페이스 테스트
브라우저에서 `http://localhost:3000/test-api`에 접속하여 API를 테스트할 수 있습니다.

### cURL 테스트
```bash
curl -X POST http://localhost:3000/api/personality-analysis \
  -F "image=@/path/to/your/image.jpg"
```

### JavaScript 테스트
```javascript
const formData = new FormData();
formData.append('image', imageFile);

const response = await fetch('/api/personality-analysis', {
  method: 'POST',
  body: formData,
});

const result = await response.json();
console.log(result.analysis);
```

## 🔒 보안 및 개인정보

- 업로드된 이미지는 분석 후 즉시 삭제됩니다
- 이미지 데이터는 외부 저장소에 저장되지 않습니다
- OpenAI API를 통한 분석만 수행되며, 로컬에 데이터를 보관하지 않습니다

## 🚨 주의사항

- OpenAI API 사용량에 따른 비용이 발생할 수 있습니다
- 이미지 파일 크기는 적절한 수준으로 제한하는 것을 권장합니다
- API 키는 절대 공개 저장소에 커밋하지 마세요

## 📝 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

## 🤝 기여

버그 리포트나 기능 제안은 이슈로 등록해 주세요.
