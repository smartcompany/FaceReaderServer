/** Play Store (Android 앱) */
export const PLAY_STORE_WEB =
  'https://play.google.com/store/apps/details?id=com.smartcompany.facereader';

/** iOS 등 Android가 아닐 때 열 웹 서비스 */
export const WEB_APP_URL = 'https://face-reader-sandy.vercel.app/';

/**
 * User-Agent 기준 다운로드/실행 URL.
 * Android → Play Store, 그 외 → 웹.
 */
export function pickDownloadUrl(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  return ua.includes('android') ? PLAY_STORE_WEB : WEB_APP_URL;
}
