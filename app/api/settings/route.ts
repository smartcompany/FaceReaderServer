import { NextResponse } from 'next/server';
import settings from './settings.json';

/**
 * 광고/업데이트 설정.
 *
 * 하위 호환:
 * - 구앱: `ads` (+ `ads.ref`) 만 사용
 * - 신앱(AdService/ForceUpdate): `ios_ads` / `android_ads` / `ref` / `min_version` / `down_load_url`
 * 한 JSON에 둘 다 두어 User-Agent 분기 없이 공존합니다.
 */
export async function GET() {
  try {
    return NextResponse.json(settings, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('[settings] Failed to load settings:', error);
    return NextResponse.json(
      { error: 'Failed to load settings' },
      { status: 500 },
    );
  }
}
