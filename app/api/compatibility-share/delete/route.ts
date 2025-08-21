import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { shareId, deleteType } = await request.json();
    
    if (!shareId || !deleteType) {
      return NextResponse.json(
        { error: 'shareId와 deleteType이 필요합니다.' },
        { status: 400 }
      );
    }

    if (deleteType !== 'sender' && deleteType !== 'receiver') {
      return NextResponse.json(
        { error: 'deleteType은 "sender" 또는 "receiver"여야 합니다.' },
        { status: 400 }
      );
    }

    // 현재 레코드 조회
    const { data: currentRecord, error: fetchError } = await supabase
      .from('compatibility_shares')
      .select('sender_delete, receiver_delete')
      .eq('id', shareId)
      .single();

    if (fetchError) {
      console.error('레코드 조회 오류:', fetchError);
      return NextResponse.json(
        { error: '레코드를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 삭제 필드 업데이트
    const updateData: any = {};
    if (deleteType === 'sender') {
      updateData.sender_delete = true;
    } else {
      updateData.receiver_delete = true;
    }

    const { error: updateError } = await supabase
      .from('compatibility_shares')
      .update(updateData)
      .eq('id', shareId);

    if (updateError) {
      console.error('삭제 필드 업데이트 오류:', updateError);
      return NextResponse.json(
        { error: '삭제 처리 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    // 업데이트된 레코드 조회
    const { data: updatedRecord, error: refetchError } = await supabase
      .from('compatibility_shares')
      .select('sender_delete, receiver_delete')
      .eq('id', shareId)
      .single();

    if (refetchError) {
      console.error('업데이트된 레코드 조회 오류:', refetchError);
      return NextResponse.json(
        { error: '업데이트된 레코드를 조회할 수 없습니다.' },
        { status: 500 }
      );
    }

    // 두 필드가 모두 true이면 레코드 삭제
    if (updatedRecord.sender_delete && updatedRecord.receiver_delete) {
      const { error: deleteError } = await supabase
        .from('compatibility_shares')
        .delete()
        .eq('id', shareId);

      if (deleteError) {
        console.error('레코드 삭제 오류:', deleteError);
        return NextResponse.json(
          { error: '레코드 삭제 중 오류가 발생했습니다.' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: '레코드가 완전히 삭제되었습니다.',
        action: 'deleted'
      });
    }

    return NextResponse.json({
      success: true,
      message: `${deleteType === 'sender' ? '보낸 사람' : '받은 사람'} 삭제 처리 완료`,
      action: 'updated'
    });

  } catch (error) {
    console.error('삭제 API 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
