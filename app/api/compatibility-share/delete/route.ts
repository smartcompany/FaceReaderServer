import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_KEY!
);

/**
 * 보낸 사람(주인): hard delete
 * 받은 사람: receiver_delete = true (목록에서 숨김)
 */
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

    const { data: currentRecord, error: fetchError } = await supabase
      .from('compatibility_shares')
      .select('id, sender_delete, receiver_delete, receiver_id')
      .eq('id', shareId)
      .single();

    if (fetchError || !currentRecord) {
      console.error('레코드 조회 오류:', fetchError);
      return NextResponse.json(
        { error: '레코드를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 보낸 사람(주인) 삭제 → DB에서 완전 삭제 (실패 시 soft-delete 폴백)
    if (deleteType === 'sender') {
      const { error: deleteError } = await supabase
        .from('compatibility_shares')
        .delete()
        .eq('id', shareId);

      if (deleteError) {
        console.error('레코드 삭제 오류, soft-delete 폴백:', deleteError);
        const { error: softError } = await supabase
          .from('compatibility_shares')
          .update({
            sender_delete: true,
            receiver_delete: true,
            interaction: 'completed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', shareId);

        if (softError) {
          console.error('soft-delete 폴백 실패:', softError);
          return NextResponse.json(
            { error: '레코드 삭제 중 오류가 발생했습니다.' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          message: '궁합 결과가 삭제되었습니다.',
          action: 'deleted',
          receiver_id: currentRecord.receiver_id,
        });
      }

      return NextResponse.json({
        success: true,
        message: '궁합 결과가 삭제되었습니다.',
        action: 'deleted',
        receiver_id: currentRecord.receiver_id,
      });
    }

    // 받은 사람 → 숨김 (receiver_delete = true)
    const { error: updateError } = await supabase
      .from('compatibility_shares')
      .update({
        receiver_delete: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', shareId);

    if (updateError) {
      console.error('숨김 처리 오류:', updateError);
      return NextResponse.json(
        { error: '숨김 처리 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '궁합 결과를 목록에서 숨겼습니다.',
      receiver_id: currentRecord.receiver_id,
      action: 'hidden',
    });
  } catch (error) {
    console.error('삭제/숨김 API 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
