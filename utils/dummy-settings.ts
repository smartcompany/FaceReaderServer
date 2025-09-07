import { createClient } from '@supabase/supabase-js';

// 환경 변수 설정
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export async function shouldUseDummyData(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('face_reader_settings')
      .select('data')
      .limit(1);

    if (error) {
      console.log('설정 조회 실패, 기본값(false) 사용:', error.message);
      return false;
    }

    if (!data || data.length === 0) {
      console.log('설정 데이터가 없음, 기본값(false) 사용');
      return false;
    }

    const settings = data[0]?.data as { use_dummy?: boolean };
    return settings?.use_dummy === true;
  } catch (error) {
    console.log('설정 조회 중 오류, 기본값(false) 사용:', error);
    return false;
  }
}

export async function loadDummyData(filename: string): Promise<any> {
  try {
    // Supabase Storage에서 더미 데이터 가져오기
    const { data, error } = await supabase.storage
      .from('face-reader')
      .download(`dummy-data/${filename}`);

    if (error) {
      console.error(`Supabase Storage에서 더미 데이터 로드 실패 (${filename}):`, error);
      return {
        success: false,
        error: '더미 데이터를 불러올 수 없습니다.'
      };
    }

    // Blob을 텍스트로 변환
    const fileContent = await data.text();
    return JSON.parse(fileContent);
  } catch (error) {
    console.error(`더미 데이터 로드 실패 (${filename}):`, error);
    return {
      success: false,
      error: '더미 데이터를 불러올 수 없습니다.'
    };
  }
}
