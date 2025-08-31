import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase 클라이언트 초기화
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_KEY!
);

// 궁합 결과 공유하기
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      senderId,        // 보내는 사람 ID
      receiverId,       // 받는 사람 ID (선택사항)
      compatibility,   // 궁합 분석 결과 JSON
    } = body;

    // 필수 필드 검증
    if (!senderId || !receiverId || !compatibility) {
      return NextResponse.json(
        { error: '필수 정보가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // 중복 공유 체크
    console.log('🔍 [POST] 중복 체크 시작');
    console.log('🔍 [POST] senderId:', senderId);
    console.log('🔍 [POST] receiverId:', receiverId);

    const { data: existingShare, error: checkError } = await supabase
      .from('compatibility_shares')
      .select('id')
      .eq('sender_id', senderId)
      .eq('receiver_id', receiverId)
      .maybeSingle();

    console.log('🔍 [POST] 중복 체크 결과 - existingShare:', existingShare);
    console.log('🔍 [POST] 중복 체크 결과 - checkError:', checkError);
    console.log('🔍 [POST] existingShare 타입:', typeof existingShare);
    console.log('🔍 [POST] existingShare 값:', existingShare);

    if (existingShare) {
      console.log('🔍 [POST] 중복 발견! 기존 공유 ID:', existingShare.id);
      return NextResponse.json(
        { 
          error: 'DUPLICATE_SHARE',
          message: '이미 공유한 사용자입니다.'
        },
        { status: 409 }  // Conflict
      );
    } else {
      console.log('🔍 [POST] 중복 없음, 새로 공유 진행');
    }

    // 궁합 결과를 Supabase에 저장
    const { data: shareData, error: shareError } = await supabase
      .from('compatibility_shares')
      .insert({
        sender_id: senderId,
        receiver_id: receiverId,
        compatibility_result: compatibility,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (shareError) {
      console.error('궁합 결과 저장 오류:', shareError);
      return NextResponse.json(
        { error: '궁합 결과 저장 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    console.log('궁합 결과 공유 성공:', shareData);

    return NextResponse.json({
      success: true,
      shareId: shareData.id,
      message: '궁합 결과가 성공적으로 공유되었습니다.',
      shareUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://face-reader-app.vercel.app'}/compatibility-share`
    });

  } catch (error) {
    console.error('궁합 결과 공유 API 오류:', error);
    
    return NextResponse.json(
      { 
        error: '궁합 결과 공유 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : '알 수 없는 오류'
      },
      { status: 500 }
    );
  }
}

// 공유된 궁합 결과 조회하기
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const receiverId = searchParams.get('receiverId');
  const senderId = searchParams.get('senderId');

  if (!receiverId && !senderId) {
    return NextResponse.json({
      success: false,
      error: 'receiverId 또는 senderId가 필요합니다.'
    });
  }

  // 사용자 ID나 보낸 사람 ID로 궁합 결과 목록 조회 (삭제된 항목 제외)
  let query = supabase
    .from('compatibility_shares')
    .select('*')
    .order('created_at', { ascending: false });

  if (receiverId) {
    // 받은 궁합: receiver_delete가 false인 항목만 조회
    query = query.eq('receiver_id', receiverId)
                 .eq('receiver_delete', false);
  } else if (senderId) {
    // 보낸 궁합: sender_delete가 false인 항목만 조회
    query = query.eq('sender_id', senderId)
                 .eq('sender_delete', false);
  }

  const { data: shares, error: sharesError } = await query;

  if (sharesError) {
    console.error('궁합 결과 조회 오류:', sharesError);
    return NextResponse.json(
      { error: '궁합 결과를 조회할 수 없습니다.' },
      { status: 500 }
    );
  }

  // JOIN을 사용하여 사용자 정보를 한 번에 조회
  if (shares && shares.length > 0) {
    // 모든 고유한 user_id 수집
    const allUserIds = new Set<string>();
    shares.forEach(share => {
      if (share.sender_id) allUserIds.add(share.sender_id);
      if (share.receiver_id) allUserIds.add(share.receiver_id);
    });

    // 한 번의 쿼리로 모든 사용자 정보 조회
    const { data: allUserData, error: userDataError } = await supabase
      .from('face_reader_user_data')
      .select('user_id, user_data')
      .in('user_id', Array.from(allUserIds));

    if (userDataError) {
      console.error('사용자 정보 조회 오류:', userDataError);
      // 에러가 발생해도 기본 share 데이터는 반환
      return NextResponse.json({
        success: true,
        shares: shares
      });
    }

    // user_id를 키로 하는 Map 생성
    const userDataMap = new Map();
    allUserData?.forEach(user => {
      userDataMap.set(user.user_id, user.user_data);
    });

    // share 데이터에 사용자 정보 추가
    const sharesWithUserInfo = shares.map(share => {
      const senderUserData = userDataMap.get(share.sender_id);
      const receiverUserData = userDataMap.get(share.receiver_id);

      return {
        ...share,
        sender_info: senderUserData ? { user_data: senderUserData } : null,
        receiver_info: receiverUserData ? { user_data: receiverUserData } : null
      };
    });

    return NextResponse.json({
      success: true,
      shares: sharesWithUserInfo
    });
  }

  return NextResponse.json({
    success: true,
    shares: shares || []
  });
}

// 상호작용 상태 응답 저장하기
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      shareId,        // 궁합 결과 ID
      interaction     // 상호작용 상태 (ENUM: interested, notInterested, chatRequest, chatDenied, chatAccepted)
    } = body;

    // 필수 필드 검증
    if (!shareId) {
      return NextResponse.json(
        { error: 'shareId가 필요합니다.' },
        { status: 400 }
      );
    }

    if (interaction === undefined || interaction === null) {
      return NextResponse.json(
        { error: '상호작용 상태가 필요합니다.' },
        { status: 400 }
      );
    }

    // 허용된 ENUM 값 검증
    const allowedInteractions = [
      'interested', 
      'notInterested', 
      'chatRequest', 
      'chatDenied', 
      'chatAccepted',
      'chatCompleted' // 새로 추가
    ];
    
    if (!allowedInteractions.includes(interaction)) {
      return NextResponse.json(
        { error: '유효하지 않은 상호작용 상태입니다.' },
        { status: 400 }
      );
    }

    // 궁합 결과의 interaction 필드 업데이트
    const { data: updateData, error: updateError } = await supabase
      .from('compatibility_shares')
      .update({ 
        interaction: interaction,
        updated_at: new Date().toISOString()
      })
      .eq('id', shareId)
      .select('id, interaction, receiver_id, sender_id, updated_at')
      .single();

    if (updateError) {
      console.error('상호작용 상태 업데이트 오류:', updateError);
      return NextResponse.json(
        { error: '상호작용 상태 업데이트 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    console.log('상호작용 상태 업데이트 성공:', updateData);

    // senderId와 receiverId를 보내면 클라이언트에서 상대방 정보를 본인아이디가 아닌것을 
    // 선택해서 보내야 한다.
    return NextResponse.json({
      success: true,
      receiverId: updateData.receiver_id,
      senderId: updateData.sender_id,
      message: '상호작용 상태가 성공적으로 저장되었습니다.'
    });

  } catch (error) {
    console.error('상호작용 상태 저장 API 오류:', error);
    
    return NextResponse.json(
      { 
        error: '상호작용 상태 저장 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : '알 수 없는 오류'
      },
      { status: 500 }
    );
  }
}

