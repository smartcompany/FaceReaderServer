import { NextRequest, NextResponse } from 'next/server';
const admin = require('firebase-admin');

admin.initializeApp();

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
    const customToken = await admin.auth().createCustomToken(uid, {
      provider: 'kakao',
      kakaoId,
    });

    return NextResponse.json({ customToken });
    
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'internal' },
      { status: 500 }
    );
  }
}