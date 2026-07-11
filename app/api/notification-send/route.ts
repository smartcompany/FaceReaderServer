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

/** FCM data 값은 모두 string 이어야 함 */
function asDataString(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value);
}

/**
 * 푸시 알림 API
 * - 서버는 type / senderName 등 메타데이터만 data로 전달
 * - title / body 문구는 클라이언트에서 사용자 로케일에 맞게 생성
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
    } = await req.json();

    if (!receiverId || !senderId || !type) {
      return NextResponse.json(
        { error: 'receiverId, senderId, type은 필수입니다' },
        { status: 400 }
      );
    }

    // 채팅 메시지는 본문(message)이 필요. 그 외 타입은 클라이언트가 문구를 만듦.
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

    const dataPayload = {
      senderId: asDataString(senderId),
      receiverId: asDataString(receiverId),
      type: asDataString(type),
      message: asDataString(message),
      chatRoomId: asDataString(chatRoomId),
      senderName: asDataString(senderName),
      compatibilityShareId: asDataString(compatibilityShareId),
    };

    // data-only: OS가 서버 title/body를 표시하지 않음 → 클라이언트가 로컬라이즈 후 표시
    const createDataOnlyPayload = (token: string) => ({
      token,
      data: dataPayload,
      android: {
        priority: 'high' as const,
      },
      apns: {
        headers: {
          'apns-priority': '10',
          'apns-push-type': 'background',
        },
        payload: {
          aps: {
            'content-available': 1,
          },
        },
      },
    });

    const sendPromises = tokens.map(async (tokenData) => {
      try {
        const payload = createDataOnlyPayload(tokenData.token);
        const result = await admin.messaging().send(payload);
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
