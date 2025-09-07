import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 환경 변수 설정
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY!;

// Supabase 클라이언트 초기화
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 더미 설정 조회
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('face_reader_settings')
      .select('*')
      .limit(1);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data?.data || { use_dummy: false }
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: '설정 조회 실패' },
      { status: 500 }
    );
  }
}

// 더미 설정 업데이트
export async function POST(request: NextRequest) {
  try {
    const { use_dummy } = await request.json();

    if (typeof use_dummy !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'use_dummy는 boolean 값이어야 합니다.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('face_reader_settings')
      .upsert({
        key: 'use_dummy',
        data: { use_dummy },
        description: 'OpenAI API 대신 더미 데이터 사용 여부 설정',
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `더미 데이터 사용이 ${use_dummy ? '활성화' : '비활성화'}되었습니다.`,
      data: data?.data
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: '설정 업데이트 실패' },
      { status: 500 }
    );
  }
}
