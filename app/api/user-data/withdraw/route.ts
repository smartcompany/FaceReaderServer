import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { success: false, message: '사용자 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    console.log(`🔄 [Withdraw] 사용자 ${userId} 탈퇴 시작`);

    // 1. 사용자 프로필 데이터 삭제
    const { error: profileError } = await supabase
      .from('face_reader_user_data')
      .delete()
      .eq('user_id', userId);

    if (profileError) {
      console.error('❌ [Withdraw] 프로필 데이터 삭제 실패:', profileError);
      return NextResponse.json(
        { success: false, message: '프로필 데이터 삭제 실패' },
        { status: 500 }
      );
    }

    // 2. 궁합 분석 결과 삭제
    const { error: compatibilityError } = await supabase
      .from('compatibility_shares')
      .delete()
      .eq('sender_id', userId);

    if (compatibilityError) {
      console.error('❌ [Withdraw] 궁합 분석 결과 삭제 실패:', compatibilityError);
    }

    // 3. FCM 토큰 삭제
    const { error: fcmError } = await supabase
      .from('fcm_tokens')
      .delete()
      .eq('user_id', userId);

    if (fcmError) {
      console.error('❌ [Withdraw] FCM 토큰 삭제 실패:', fcmError);
    }

    // 4. 채팅 관련 데이터 삭제 (채팅 테이블이 있다면)
    // TODO: 채팅 테이블이 생성되면 여기에 추가

    console.log(`✅ [Withdraw] 사용자 ${userId} 탈퇴 완료`);

    return NextResponse.json({
      success: true,
      message: '계정이 성공적으로 탈퇴되었습니다.',
      data: {
        userId,
        deletedAt: new Date().toISOString(),
      }
    });

  } catch (error) {
    console.error('❌ [Withdraw] 탈퇴 처리 중 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: '탈퇴 처리 중 오류가 발생했습니다.' 
      },
      { status: 500 }
    );
  }
}
