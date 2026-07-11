import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Firebase Admin SDK 설정 (환경변수에서 가져오기)
const admin = require('firebase-admin');

// Firebase Admin 초기화 (한 번만 실행)
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('✅ Firebase Admin 초기화 완료');
  } catch (error) {
    console.error('❌ Firebase Admin 초기화 실패:', error);
  }
}

export async function POST(req: Request) {
  try {
    const { receiverId, message, senderId, type, chatRoomId, senderName, compatibilityShareId } = await req.json();

    if (!receiverId || !message || !senderId) {
      return NextResponse.json(
        { error: 'receiverId, message, senderId는 필수입니다' }, 
        { status: 400 }
      );
    }

    console.log('🔔 푸시 알림 요청:', { receiverId, message, senderId, type, chatRoomId, senderName, compatibilityShareId });

    // 수신자의 FCM 토큰 조회
    const { data: tokens, error: tokenError } = await supabase
      .from('face_reader_fcm_tokens')
      .select('token, platform')
      .eq('user_id', receiverId);

    if (tokenError) {
      console.error('❌ FCM 토큰 조회 오류:', tokenError);
      return NextResponse.json({ error: tokenError.message }, { status: 500 });
    }

    if (!tokens || tokens.length === 0) {
      console.log('⚠️ 수신자의 FCM 토큰이 없습니다:', receiverId);
      return NextResponse.json({ error: '수신자의 FCM 토큰이 없습니다' }, { status: 404 });
    }

    // 알림 제목과 내용 설정
    let title = '';
    let body = message;

    switch (type) {
      case 'chat_message':
        title = `${senderName}님으로부터 메시지`;
        break;
      case 'chat_room_created':
        title = `${senderName}님이 채팅방을 생성했습니다`;
        body = '새로운 채팅방에 참여하세요!';
        break;
      case 'compatibility_share':
        title = `${senderName}님이 궁합 결과를 공유했습니다`;
        body = '궁합 분석 결과를 확인해보세요!';
        break;
      case 'interested':
        title = `${senderName}이 관심있음으로 응답 했습니다.`;
        body = message || '공유된 궁합 결과를 확인해보세요!';
        break;
      case 'chatRequest':
        title = `${senderName}님이 대화를 요청했습니다`;
        body = '대화 요청에 응답해주세요!';
        break;
      case 'chatAccepted':
        title = `${senderName}님이 대화를 수락했습니다`;
        body = '이제 대화를 시작할 수 있습니다!';
        break;
      default:
        title = `${senderName}님으로부터 알림`;
    }

    // payload 생성 함수들
    const createChatMessagePayload = (token: string) => ({
      notification: {
        title,
        body,
      },
      data: {
        senderId: senderId,
        receiverId: receiverId,
        type: type,
        message: message,
        chatRoomId: chatRoomId,
        senderName: senderName,
        compatibilityShareId: compatibilityShareId,
      },
      token,
    });

    const createInteractionPayload = (token: string) => ({
      notification: {
        title,
        body,
      },
      data: {
        senderId: senderId,
        receiverId: receiverId,
        type: type,
        message: message,
        senderName: senderName,
        compatibilityShareId: compatibilityShareId,
      },
      token,
    });

    // 각 토큰에 대해 푸시 알림 전송
    const sendPromises = tokens.map(async (tokenData) => {
      try {
        // type에 따라 다른 payload 생성
        const payload = type === 'chat_message' 
          ? createChatMessagePayload(tokenData.token)
          : createInteractionPayload(tokenData.token);

        const result = await admin.messaging().send(payload);
        console.log('✅ 푸시 알림 전송 성공:', result);
        return { success: true, token: tokenData.token };
      } catch (error: any) {
        console.error('❌ 푸시 알림 전송 실패:', error);
        
        // 유효하지 않은 토큰인 경우 데이터베이스에서 제거
        if (error.code === 'messaging/invalid-registration-token' || 
            error.code === 'messaging/registration-token-not-registered') {
          console.log('🗑️ 유효하지 않은 토큰 제거:', tokenData.token);
          await supabase
            .from('face_reader_fcm_tokens')
            .delete()
            .eq('token', tokenData.token);
        }
        
        return { success: false, token: tokenData.token, error: error.message };
      }
    });

    const results = await Promise.all(sendPromises);
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`📊 푸시 알림 결과: 성공 ${successCount}, 실패 ${failCount}`);

    if (successCount > 0) {
      return NextResponse.json({ 
        success: true, 
        message: '푸시 알림이 전송되었습니다',
        results: {
          success: successCount,
          failed: failCount,
          details: results
        }
      });
    } else {
      return NextResponse.json({ 
        error: '모든 푸시 알림 전송에 실패했습니다',
        results: {
          success: successCount,
          failed: failCount,
          details: results
        }
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('❌ 푸시 알림 API 오류:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
