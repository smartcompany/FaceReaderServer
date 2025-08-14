'use client';

import { useState } from 'react';

export default function TestCompatibilityAPI() {
  const [image1, setImage1] = useState<File | null>(null);
  const [image2, setImage2] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImage1Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImage1(e.target.files[0]);
    }
  };

  const handleImage2Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImage2(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!image1 || !image2) {
      setError('두 개의 이미지를 모두 선택해주세요.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('image1', image1);
      formData.append('image2', image2);

      const response = await fetch('/api/compatibility-analysis', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setResult(data);
      } else {
        setError(data.error || '궁합 분석 중 오류가 발생했습니다.');
      }
    } catch (err) {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-white text-center mb-8">
          궁합 분석 API 테스트
        </h1>
        
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 mb-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 첫 번째 이미지 */}
              <div className="space-y-3">
                <label className="block text-white font-semibold">
                  첫 번째 사람의 사진
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImage1Change}
                  className="w-full p-3 bg-white/20 border border-white/30 rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-white/20 file:text-white hover:file:bg-white/30"
                />
                {image1 && (
                  <div className="text-sm text-white/80">
                    선택된 파일: {image1.name}
                  </div>
                )}
              </div>

              {/* 두 번째 이미지 */}
              <div className="space-y-3">
                <label className="block text-white font-semibold">
                  두 번째 사람의 사진
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImage2Change}
                  className="w-full p-3 bg-white/20 border border-white/30 rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-white/20 file:text-white hover:file:bg-white/30"
                />
                {image2 && (
                  <div className="text-sm text-white/80">
                    선택된 파일: {image2.name}
                  </div>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !image1 || !image2}
              className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-xl hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {loading ? '궁합 분석 중...' : '궁합 분석하기'}
            </button>
          </form>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 mb-6">
            <p className="text-red-200 text-center">{error}</p>
          </div>
        )}

        {/* 결과 표시 */}
        {result && (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white text-center mb-6">
              궁합 분석 결과
            </h2>
            
            <div className="space-y-6">
              {/* 전반적인 궁합 점수 */}
              <div className="text-center">
                <div className="text-6xl font-bold text-yellow-400 mb-2">
                  {result.compatibility.overall_score}점
                </div>
                <div className="text-white/80">전반적인 궁합 점수</div>
              </div>

              {/* 상세 분석 결과 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white border-b border-white/30 pb-2">
                    성격적 궁합
                  </h3>
                  <p className="text-white/90 leading-relaxed">
                    {result.compatibility.personality_compatibility}
                  </p>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white border-b border-white/30 pb-2">
                    감정적 궁합
                  </h3>
                  <p className="text-white/90 leading-relaxed">
                    {result.compatibility.emotional_compatibility}
                  </p>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white border-b border-white/30 pb-2">
                    대인관계 궁합
                  </h3>
                  <p className="text-white/90 leading-relaxed">
                    {result.compatibility.social_compatibility}
                  </p>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white border-b border-white/30 pb-2">
                    커뮤니케이션 궁합
                  </h3>
                  <p className="text-white/90 leading-relaxed">
                    {result.compatibility.communication_compatibility}
                  </p>
                </div>
              </div>

              {/* 장기적 관계 전망 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white border-b border-white/30 pb-2">
                  장기적 관계 전망
                </h3>
                <p className="text-white/90 leading-relaxed">
                  {result.compatibility.long_term_prospects}
                </p>
              </div>

              {/* 궁합 개선 방안 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white border-b border-white/30 pb-2">
                  궁합 개선 방안
                </h3>
                <p className="text-white/90 leading-relaxed">
                  {result.compatibility.improvement_suggestions}
                </p>
              </div>

              {/* 주의사항 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white border-b border-white/30 pb-2">
                  주의사항
                </h3>
                <p className="text-white/90 leading-relaxed">
                  {result.compatibility.precautions}
                </p>
              </div>

              {/* 분석 시간 */}
              <div className="text-center text-white/60 text-sm">
                분석 완료 시간: {new Date(result.timestamp).toLocaleString('ko-KR')}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
