import { NextRequest, NextResponse } from 'next/server';
const admin = require('firebase-admin');

// Firebase Admin SDK가 이미 초기화되었는지 확인
if (!admin.apps.length) {
  // FIREBASE_SERVICE_ACCOUNT_KEY 환경 변수에서 JSON 파싱
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  
  if (!serviceAccountKey) {
    console.error('FIREBASE_SERVICE_ACCOUNT_KEY 환경 변수가 설정되지 않았습니다.');
    throw new Error('Firebase 서비스 계정 키가 설정되지 않았습니다.');
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountKey);
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    
    console.log('Firebase Admin SDK 초기화 성공');
  } catch (parseError) {
    console.error('FIREBASE_SERVICE_ACCOUNT_KEY JSON 파싱 실패:', parseError);
    throw new Error('Firebase 서비스 계정 키 JSON 파싱 실패');
  }
}

export async function POST(request: NextRequest) {
  try {
    const { kakaoAccessToken } = await request.json();
    if (!kakaoAccessToken) {
      return NextResponse.json(
        { error: 'missing kakaoAccessToken' },
        { status: 400 }
      );
    }

    // 1) 토큰 정보 확인 (앱 매칭/만료)
    const infoResp = await fetch('https://kapi.kakao.com/v1/user/access_token_info', {
      headers: { Authorization: `Bearer ${kakaoAccessToken}` }
    });
    
    if (!infoResp.ok) {
      return NextResponse.json(
        { error: 'invalid kakao token' },
        { status: 401 }
      );
    }
    
    const info = await infoResp.json();
    
    // 내 카카오 앱 ID와 일치 검증
    const MY_KAKAO_APP_ID = 1302523;
    if (info.app_id !== MY_KAKAO_APP_ID) {
      return NextResponse.json(
        { error: 'app_id mismatch' },
        { status: 401 }
      );
    }

    // 2) 사용자 정보 조회
    const meResp = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${kakaoAccessToken}` }
    });
    
    if (!meResp.ok) {
      return NextResponse.json(
        { error: 'cannot fetch user' },
        { status: 401 }
      );
    }
    
    const me = await meResp.json();
    const kakaoId = String(me.id);

    // 3) Firebase 커스텀 토큰 생성
    const uid = `kakao:${kakaoId}`;
    console.log('🔍 [Kakao Auth] Firebase Custom Token 생성 시작 - UID:', uid);
    
    try {
      const customToken = await admin.auth().createCustomToken(uid, {
        provider: 'kakao',
        kakaoId,
      });
      
      console.log('✅ [Kakao Auth] Firebase Custom Token 생성 성공');
      return NextResponse.json({ 
        success: true,
        customToken: customToken 
      });
    } catch (firebaseError) {
      console.error('❌ [Kakao Auth] Firebase Custom Token 생성 실패:', firebaseError);
      
      return NextResponse.json({ 
        success: false,
        error: 'Firebase Custom Token 생성 실패',
        details: firebaseError.message
      }, { status: 500 });
    }
    
  } catch (e) {
    console.error('Kakao Auth Error:', e);
    console.error('Error stack:', e.stack);
    return NextResponse.json(
      { error: 'internal', details: e.message },
      { status: 500 }
    );
  }
}