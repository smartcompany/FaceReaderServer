export default function Page() {
  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            🚀 FaceReader Server
          </h1>
          <p className="text-xl text-gray-600">
            AI 기반 얼굴 분석 및 호환성 테스트 서버
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-4">🧪 API 테스트</h3>
            <p className="text-gray-600 mb-4">
              기본 API 엔드포인트들을 테스트해보세요
            </p>
            <a
              href="/test-api"
              className="inline-block bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
            >
              API 테스트 페이지
            </a>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-4">🔮 호환성 분석</h3>
            <p className="text-gray-600 mb-4">
              호환성 분석 API를 테스트해보세요
            </p>
            <a
              href="/test-compatibility-api"
              className="inline-block bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition-colors"
            >
              호환성 분석 테스트
            </a>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-4">🔗 카카오 웹훅</h3>
            <p className="text-gray-600 mb-4">
              카카오 계정 웹훅을 테스트해보세요
            </p>
            <a
              href="/test-kakao-webhook"
              className="inline-block bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 transition-colors"
            >
              카카오 웹훅 테스트
            </a>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold mb-4">📋 사용 가능한 API</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold text-gray-700 mb-2">🔐 인증 & 사용자</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• POST /api/user-data - 사용자 데이터 관리</li>
                <li>• POST /api/fcm-token - FCM 토큰 등록</li>
                <li>• POST /api/settings - 설정 저장</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-700 mb-2">🧠 AI 분석</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• POST /api/personality-analysis - 성격 분석</li>
                <li>• POST /api/fortune-prediction - 오늘의 운세 예측</li>
                <li>• POST /api/compatibility-analysis - 호환성 분석</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-700 mb-2">📱 알림 & 공유</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• POST /api/notification-send - 푸시 알림 전송</li>
                <li>• POST /api/compatibility-share - 호환성 결과 공유</li>
                <li>• POST /api/kakao-account - 카카오 웹훅</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-700 mb-2">📊 데이터 관리</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• GET /api/recent-users - 최근 사용자 목록</li>
                <li>• DELETE /api/compatibility-share - 공유 결과 삭제</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="text-center mt-8">
          <p className="text-gray-500">
            🚀 Vercel에서 호스팅되는 Next.js API 서버
          </p>
        </div>
      </div>
    </div>
  );
}
