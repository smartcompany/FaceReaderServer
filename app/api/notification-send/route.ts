import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const admin = require('firebase-admin');

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

function asDataString(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value);
}

/**
 * 푸시 알림 API
 * - data: type / senderName 등 (클라이언트가 로케일별 문구 재생성)
 * - notification: title/body (백그라운드 OS 표시용, 클라이언트가 전달)
 */
export async function POST(req: Request) {
  try {
    const {
      receiverId,
      message,
      senderId,
      type,
      chatRoomId,
      senderName,
      compatibilityShareId,
      title: titleFromClient,
      body: bodyFromClient,
    } = await req.json();

    if (!receiverId || !senderId || !type) {
      return NextResponse.json(
        { error: 'receiverId, senderId, type은 필수입니다' },
        { status: 400 }
      );
    }

    if (type === 'chat_message' && (message === undefined || message === null || message === '')) {
      return NextResponse.json(
        { error: 'chat_message 타입은 message가 필요합니다' },
        { status: 400 }
      );
    }

    console.log('🔔 푸시 알림 요청:', {
      receiverId,
      message,
      senderId,
      type,
      chatRoomId,
      senderName,
      compatibilityShareId,
      titleFromClient,
      bodyFromClient,
    });

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

    const name = asDataString(senderName) || 'User';
    const fallback = fallbackCopy(type, name, asDataString(message));
    const title = asDataString(titleFromClient) || fallback.title;
    const body = asDataString(bodyFromClient) || fallback.body;

    const dataPayload = {
      senderId: asDataString(senderId),
      receiverId: asDataString(receiverId),
      type: asDataString(type),
      message: asDataString(message),
      chatRoomId: asDataString(chatRoomId),
      senderName: asDataString(senderName),
      compatibilityShareId: asDataString(compatibilityShareId),
      title,
      body,
    };

    const createPayload = (token: string) => ({
      token,
      // 백그라운드에서도 OS 알림이 보이도록 notification 포함
      notification: {
        title,
        body,
      },
      data: dataPayload,
      android: {
        priority: 'high' as const,
        notification: {
          channelId: 'face_reader_push',
          sound: 'default',
        },
      },
      apns: {
        headers: {
          'apns-priority': '10',
          'apns-push-type': 'alert',
        },
        payload: {
          aps: {
            alert: {
              title,
              body,
            },
            sound: 'default',
            'content-available': 1,
          },
        },
      },
    });

    const sendPromises = tokens.map(async (tokenData) => {
      try {
        const result = await admin.messaging().send(createPayload(tokenData.token));
        console.log('✅ 푸시 알림 전송 성공:', result);
        return { success: true, token: tokenData.token };
      } catch (error: any) {
        console.error('❌ 푸시 알림 전송 실패:', error);

        if (
          error.code === 'messaging/invalid-registration-token' ||
          error.code === 'messaging/registration-token-not-registered'
        ) {
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
    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    console.log(`📊 푸시 알림 결과: 성공 ${successCount}, 실패 ${failCount}`);

    if (successCount > 0) {
      return NextResponse.json({
        success: true,
        message: '푸시 알림이 전송되었습니다',
        results: {
          success: successCount,
          failed: failCount,
          details: results,
        },
      });
    }

    return NextResponse.json(
      {
        error: '모든 푸시 알림 전송에 실패했습니다',
        results: {
          success: successCount,
          failed: failCount,
          details: results,
        },
      },
      { status: 500 }
    );
  } catch (error: any) {
    console.error('❌ 푸시 알림 API 오류:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** 클라이언트가 title/body를 안 보냈을 때 쓰는 폴백 (영문) */
function fallbackCopy(type: string, senderName: string, message: string) {
  switch (type) {
    case 'chat_message':
      return {
        title: senderName,
        body: message || 'New message',
      };
    case 'chat_room_created':
      return {
        title: `${senderName} created a chat`,
        body: 'Join the conversation',
      };
    case 'compatibility_share':
      return {
        title: `${senderName} shared compatibility`,
        body: 'Check the result and allow the chat',
      };
    case 'accepted':
      return {
        title: `${senderName} allowed the chat`,
        body: 'You can start chatting now',
      };
    case 'declined':
      return {
        title: `${senderName} declined the chat`,
        body: 'You can try again later',
      };
    default:
      return {
        title: `Notification from ${senderName}`,
        body: message || 'New notification',
      };
  }
}
