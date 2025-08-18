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
      senderName,      // 보내는 사람 이름
      partnerId,       // 받는 사람 ID (선택사항)
      partnerName,     // 받는 사람 이름
      partnerAge,      // 받는 사람 나이
      partnerLocation, // 받는 사람 위치
      partnerGender,   // 받는 사람 성별
      compatibility,   // 궁합 분석 결과 JSON
      images,          // 이미지 정보
      timestamp,       // 분석 완료 시간
      shareCode        // 공유 코드 (선택사항)
    } = body;

    // 필수 필드 검증
    if (!senderId || !senderName || !partnerName || !compatibility) {
      return NextResponse.json(
        { error: '필수 정보가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // 공유 코드 생성 (없으면 자동 생성)
    const finalShareCode = shareCode || generateShareCode();
    
    // 궁합 결과를 Supabase에 저장
    const { data: shareData, error: shareError } = await supabase
      .from('compatibility_shares')
      .insert({
        sender_id: senderId,
        sender_name: senderName,
        partner_id: partnerId || null,
        partner_name: partnerName,
        partner_age: partnerAge || null,
        partner_location: partnerLocation || null,
        partner_gender: partnerGender || null,
        compatibility_result: compatibility,
        images: images,
        timestamp: timestamp,
        share_code: finalShareCode,
        created_at: new Date().toISOString(),
        is_viewed: false
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
      shareCode: finalShareCode,
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

  // 사용자 ID나 보낸 사람 ID로 궁합 결과 목록 조회
  let query = supabase
    .from('compatibility_shares')
    .select('*')
    .order('created_at', { ascending: false });

  if (receiverId) {
    query = query.eq('partner_id', receiverId);
  } else if (senderId) {
    query = query.eq('sender_id', senderId);
  }

  const { data: shares, error: sharesError } = await query;

  if (sharesError) {
    console.error('궁합 결과 조회 오류:', sharesError);
    return NextResponse.json(
      { error: '궁합 결과를 조회할 수 없습니다.' },
      { status: 500 }
    );
  }

  // userId인 경우에만 sender 정보 조회 (받은 궁합)
  if (shares && shares.length > 0) {
    const sharesWithSenderInfo = await Promise.all(
      shares.map(async (share) => {
        let matchId;
        if (receiverId) {
          matchId = share.sender_id;
        } else if (senderId) {
          matchId = share.partner_id;
        }

        if (matchId) {
          try {
            const { data: userData, error: userError } = await supabase
              .from('face_reader_user_data')
              .select('user_data')
              .eq('user_id', matchId)
              .single();

            if (!userError && userData) {
              return {
                ...share,
                match_info: { user_data: userData.user_data }
              };
            }
          } catch (e) {
            console.log(`사용자 ${matchId} 정보 조회 실패:`, e);
          }
        }
        
        // match_info 없으면 기본 정보만 반환
        return share;
      })
    );

    return NextResponse.json({
      success: true,
      shares: sharesWithSenderInfo
    });
  }

  return NextResponse.json({
    success: true,
    shares: shares || []
  });
}

// 관심도 응답 저장하기
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      shareId,        // 궁합 결과 ID
      interest        // 관심도 (true: 관심있음, false: 관심없음)
    } = body;

    // 필수 필드 검증
    if (!shareId) {
      return NextResponse.json(
        { error: 'shareId가 필요합니다.' },
        { status: 400 }
      );
    }

    if (interest === undefined || interest === null) {
      return NextResponse.json(
        { error: '관심도 응답이 필요합니다.' },
        { status: 400 }
      );
    }

    // 궁합 결과의 interest 필드 업데이트
    const { data: updateData, error: updateError } = await supabase
      .from('compatibility_shares')
      .update({ 
        interest: interest,
        updated_at: new Date().toISOString()
      })
      .eq('id', shareId)
      .select()
      .single();

    if (updateError) {
      console.error('관심도 응답 업데이트 오류:', updateError);
      return NextResponse.json(
        { error: '관심도 응답 업데이트 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    console.log('관심도 응답 업데이트 성공:', updateData);

    return NextResponse.json({
      success: true,
      message: '관심도 응답이 성공적으로 저장되었습니다.'
    });

  } catch (error) {
    console.error('관심도 응답 저장 API 오류:', error);
    
    return NextResponse.json(
      { 
        error: '관심도 응답 저장 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : '알 수 없는 오류'
      },
      { status: 500 }
    );
  }
}

// 공유 코드 생성 함수
function generateShareCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
