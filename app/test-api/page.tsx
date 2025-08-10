'use client';

import { useState } from 'react';

export default function TestAPIPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file);
      setError('');
    } else {
      setError('이미지 파일을 선택해주세요.');
      setSelectedFile(null);
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      setError('이미지를 선택해주세요.');
      return;
    }

    setLoading(true);
    setError('');
    setAnalysis('');

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);

      const response = await fetch('/api/personality-analysis', {
        method: 'POST',
        body: formData,
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
          <h2 className="text-xl font-semibold text-white mb-4">이미지 업로드</h2>
          
          <div className="mb-4">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="block w-full text-sm text-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700"
            />
          </div>

          {selectedFile && (
            <div className="mb-4">
              <p className="text-white mb-2">선택된 파일: {selectedFile.name}</p>
              <img
                src={URL.createObjectURL(selectedFile)}
                alt="Preview"
                className="max-w-xs rounded-lg"
              />
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={!selectedFile || loading}
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
            <div className="bg-white/5 rounded-lg p-4">
              <pre className="text-white whitespace-pre-wrap font-sans text-sm leading-relaxed">
                {analysis}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
