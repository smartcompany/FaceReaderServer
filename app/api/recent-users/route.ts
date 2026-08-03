import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export async function GET(req: Request) {
  try {
    console.log('=== recent-users GET 요청 시작 ===');

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const gender = url.searchParams.get('gender'); // male | female | null
    const offset = (page - 1) * limit;

    console.log(
      '페이징 정보 - page:',
      page,
      'limit:',
      limit,
      'offset:',
      offset,
      'gender:',
      gender,
    );

    let query = supabase
      .from('face_reader_user_data')
      .select('user_id, user_data, updated_at', { count: 'exact' })
      .order('updated_at', { ascending: false });

    if (gender === 'male' || gender === 'female') {
      query = query.eq('user_data->>gender', gender);
    }

    const { data, error, count } = await query.range(
      offset,
      offset + limit - 1,
    );

    if (error) {
      console.error('Supabase query error:', error);
      return NextResponse.json(
        {
          success: false,
          message: '데이터베이스 조회에 실패했습니다.',
          error: error.message,
        },
        { status: 500 },
      );
    }

    if (!data || data.length == 0) {
      console.log('해당 페이지에 사용자가 없습니다.');
      return NextResponse.json({
        success: true,
        data: [],
        pagination: {
          page: page,
          limit: limit,
          total: count || 0,
          hasMore: false,
        },
        message: '해당 페이지에 사용자가 없습니다.',
      });
    }

    const recentUsers = data.map((user: any) => ({
      userId: user.user_id,
      nickname: user.user_data?.nickname,
      age: user.user_data?.age ? `${user.user_data.age}세` : '나이 미설정',
      location: user.user_data?.region,
      photoUrl: user.user_data?.photoUrl,
      gender: user.user_data?.gender,
      bio: user.user_data?.bio ?? null,
      lastUpdated: user.updated_at,
    }));

    const total = count || 0;
    const hasMore = offset + limit < total;

    console.log('최근 사용자 목록:', recentUsers);
    console.log('페이징 정보 - total:', total, 'hasMore:', hasMore);

    return NextResponse.json({
      success: true,
      data: recentUsers,
      pagination: {
        page: page,
        limit: limit,
        total: total,
        hasMore: hasMore,
      },
      message: '최근 사용자 목록을 성공적으로 가져왔습니다.',
    });
  } catch (e: any) {
    console.error('Server error:', e);
    return NextResponse.json(
      {
        success: false,
        message: '서버 오류가 발생했습니다.',
        error: e.message,
      },
      { status: 500 },
    );
  }
}
