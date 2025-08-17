import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log('user-profile POST input:', body);

    const { userProfile } = body;

    // 필수 필드 검증
    if (!userProfile || !userProfile.userId || !userProfile.email) {
      return NextResponse.json({ 
        success: false, 
        message: '필수 필드가 누락되었습니다.',
        error: 'userId와 email은 필수입니다.' 
      }, { status: 400 });
    }

    // provider 기본값 설정 (기존 Google 사용자 호환성)
    const provider = userProfile.provider || 'google';

    // Supabase에 사용자 프로필 데이터 저장
    const { data, error } = await supabase
      .from('face_reader_user_data')
      .upsert(
        {
          user_id: userProfile.userId,
          provider: provider, // provider 필드 추가
          user_data: {
            email: userProfile.email,
            displayName: userProfile.displayName,
            nickname: userProfile.nickname,
            gender: userProfile.gender,
            age: userProfile.age,
            region: userProfile.region,
            photoUrl: userProfile.photoUrl
          },
          updated_at: new Date().toISOString()
        },
        { onConflict: 'provider,user_id' } // 복합 키로 충돌 처리
      )
      .select();

    console.log('Supabase upsert result:', data, error);

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ 
        success: false, 
        message: '데이터베이스 저장에 실패했습니다.',
        error: error.message 
      }, { status: 500 });
    }
    
    if (!data || data.length == 0) {
      return NextResponse.json({ 
        success: false, 
        message: '데이터 저장 후 조회에 실패했습니다.',
        error: '저장된 데이터를 찾을 수 없습니다.' 
      }, { status: 500 });
    }

    // 성공 응답
    return NextResponse.json({
      success: true,
      message: '사용자 프로필이 성공적으로 저장되었습니다.',
      data: {
        userId: data[0].user_id,
        provider: data[0].provider,
        email: userProfile.email,
        displayName: userProfile.displayName,
        nickname: userProfile.nickname,
        gender: userProfile.gender,
        age: userProfile.age,
        region: userProfile.region,
        photoUrl: userProfile.photoUrl,
        createdAt: data[0].user_data.createdAt,
        updatedAt: data[0].user_data.updatedAt,
      }
    }, { status: 201 });

  } catch (e: any) {
    console.error('Server error:', e);
    return NextResponse.json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: e.message 
    }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');
    const provider = url.searchParams.get('provider') || 'google'; // provider 파라미터 추가

    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        message: 'userId 파라미터가 필요합니다.',
        error: 'userId를 쿼리 파라미터로 전달해주세요.' 
      }, { status: 400 });
    }

    console.log('user-profile GET request for userId:', userId, 'provider:', provider);

    // Supabase에서 사용자 프로필 데이터 조회 (provider 포함)
    const { data, error } = await supabase
      .from('face_reader_user_data')
      .select('user_id, provider, user_data, updated_at')
      .eq('user_id', userId)
      .eq('provider', provider) // provider로도 필터링
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // 데이터가 없는 경우
        return NextResponse.json({ 
          success: false, 
          message: '사용자를 찾을 수 없습니다.',
          error: '해당 userId와 provider로 등록된 사용자가 없습니다.' 
        }, { status: 404 });
      }
      
      console.error('Supabase query error:', error);
      return NextResponse.json({ 
        success: false, 
        message: '데이터베이스 조회에 실패했습니다.',
        error: error.message 
      }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ 
        success: false, 
        message: '사용자 데이터를 찾을 수 없습니다.',
        error: '데이터가 null입니다.' 
      }, { status: 404 });
    }

    // 성공 응답
    return NextResponse.json({
      success: true,
      data: {
        userId: data.user_id,
        provider: data.provider,
        email: data.user_data.email,
        displayName: data.user_data.displayName,
        nickname: data.user_data.nickname,
        gender: data.user_data.gender,
        age: data.user_data.age,
        region: data.user_data.region,
        photoUrl: data.user_data.photoUrl,
        createdAt: data.user_data.createdAt,
        updatedAt: data.user_data.updatedAt,
      }
    });

  } catch (e: any) {
    console.error('Server error:', e);
    return NextResponse.json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: e.message 
    }, { status: 500 });
  }
}