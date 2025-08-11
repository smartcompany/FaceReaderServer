'use client';

import { useState } from 'react';

export default function TestAPIPage() {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const handleUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const url = event.target.value;
    setImageUrl(url);
    setError('');
  };

  const handleSubmit = async () => {
    if (!imageUrl.trim()) {
      setError('이미지 URL을 입력해주세요.');
      return;
    }

    // URL 유효성 검사
    try {
      new URL(imageUrl);
    } catch (error) {
      setError('유효하지 않은 URL입니다.');
      return;
    }

    setLoading(true);
    setError('');
    setAnalysis(null);

    try {
      const response = await fetch('/api/personality-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl: imageUrl
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setAnalysis(data.analysis);
      } else {
        setError(data.error || '분석 중 오류가 발생했습니다.');
      }
    } catch (err) {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-purple-700 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white text-center mb-8">
          성격 분석 API 테스트
        </h1>
        
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">이미지 URL 입력</h2>
          
          <div className="mb-4">
            <input
              type="url"
              placeholder="https://example.com/image.jpg"
              value={imageUrl}
              onChange={handleUrlChange}
              className="block w-full px-4 py-3 text-white bg-white/20 rounded-lg border border-white/30 focus:outline-none focus:border-purple-400 placeholder-white/60"
            />
          </div>

          {imageUrl && (
            <div className="mb-4">
              <p className="text-white mb-2">입력된 URL: {imageUrl}</p>
              <img
                src={imageUrl}
                alt="Preview"
                className="max-w-xs rounded-lg"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  setError('이미지를 불러올 수 없습니다. URL을 확인해주세요.');
                }}
              />
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={!imageUrl.trim() || loading}
            className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white font-bold py-3 px-6 rounded-full disabled:opacity-50 disabled:cursor-not-allowed hover:from-green-600 hover:to-green-700 transition-all duration-200"
          >
            {loading ? '분석 중...' : '성격 분석 시작하기'}
          </button>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6">
            <p className="text-red-200">{error}</p>
          </div>
        )}

        {analysis && (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">분석 결과</h2>
            <div className="space-y-4">
              {Object.entries(analysis).map(([key, section]: [string, any]) => (
                <div key={key} className="bg-white/5 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {section.title}
                  </h3>
                  <p className="text-white/90 leading-relaxed">
                    {section.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
