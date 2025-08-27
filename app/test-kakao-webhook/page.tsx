'use client';

import { useState } from 'react';

export default function TestKakaoWebhook() {
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const testWebhook = async (eventType: string) => {
    setLoading(true);
    setResult('');

    try {
      const testData = {
        event_type: eventType,
        user_id: `test_user_${Date.now()}`,
        timestamp: new Date().toISOString(),
        additional_data: {
          platform: 'kakao',
          app_id: 'test_app'
        }
      };

      console.log('🔍 [테스트] 웹훅 데이터 전송:', testData);

      const response = await fetch('/api/kakao-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testData),
      });

      const responseData = await response.json();
      
      if (response.ok) {
        setResult(`✅ 성공: ${JSON.stringify(responseData, null, 2)}`);
      } else {
        setResult(`❌ 실패 (${response.status}): ${JSON.stringify(responseData, null, 2)}`);
      }
    } catch (error) {
      setResult(`❌ 오류: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const testGetEndpoint = async () => {
    setLoading(true);
    setResult('');

    try {
      const response = await fetch('/api/kakao-account');
      const responseData = await response.json();
      
      if (response.ok) {
        setResult(`✅ GET 성공: ${JSON.stringify(responseData, null, 2)}`);
      } else {
        setResult(`❌ GET 실패 (${response.status}): ${JSON.stringify(responseData, null, 2)}`);
      }
    } catch (error) {
      setResult(`❌ GET 오류: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-6">
            🔗 카카오 웹훅 테스트
          </h1>
          
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-700 mb-3">
              웹훅 엔드포인트 정보
            </h2>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">
                <strong>URL:</strong> https://face-reader-server.vercel.app/api/kakao-account
              </p>
              <p className="text-sm text-gray-600 mb-2">
                <strong>메서드:</strong> POST (웹훅 수신), GET (상태 확인)
              </p>
              <p className="text-sm text-gray-600">
                <strong>지원 이벤트:</strong> USER_LINKED, USER_UNLINKED, ACCOUNT_STATUS_CHANGED
              </p>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-700 mb-3">
              웹훅 테스트
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <button
                onClick={() => testWebhook('USER_LINKED')}
                disabled={loading}
                className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-lg transition-colors"
              >
                🔗 사용자 연결 테스트
              </button>
              
              <button
                onClick={() => testWebhook('USER_UNLINKED')}
                disabled={loading}
                className="bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-lg transition-colors"
              >
                🔓 사용자 연결 해제 테스트
              </button>
              
              <button
                onClick={() => testWebhook('ACCOUNT_STATUS_CHANGED')}
                disabled={loading}
                className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-lg transition-colors"
              >
                📊 계정 상태 변경 테스트
              </button>
            </div>
            
            <button
              onClick={testGetEndpoint}
              disabled={loading}
              className="bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              🔍 엔드포인트 상태 확인
            </button>
          </div>

          {loading && (
            <div className="text-center py-4">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <p className="mt-2 text-gray-600">처리 중...</p>
            </div>
          )}

          {result && (
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-700 mb-3">
                테스트 결과
              </h2>
              <div className="bg-gray-50 p-4 rounded-lg">
                <pre className="text-sm text-gray-800 whitespace-pre-wrap overflow-x-auto">
                  {result}
                </pre>
              </div>
            </div>
          )}

          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-700 mb-3">
              카카오 개발자 설정 가이드
            </h2>
            <div className="bg-blue-50 p-4 rounded-lg">
              <ol className="list-decimal list-inside text-sm text-gray-700 space-y-2">
                <li>카카오 개발자 콘솔에서 앱 생성</li>
                <li>플랫폼 설정 (Android/iOS)</li>
                <li>웹훅 URL 설정: <code className="bg-blue-100 px-2 py-1 rounded">https://face-reader-server.vercel.app/api/kakao-account</code></li>
                <li>OAuth 이벤트에서 "User Linked" 체크</li>
                <li>웹훅 저장 및 활성화</li>
              </ol>
            </div>
          </div>

          <div className="text-center">
            <a
              href="https://developers.kakao.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-white font-medium rounded-lg transition-colors"
            >
              🚀 카카오 개발자 콘솔 바로가기
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
