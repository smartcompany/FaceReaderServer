import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('🔍 [카카오 웹훅] 수신된 데이터:', JSON.stringify(body, null, 2));
    
    // 카카오 웹훅 검증
    if (!body || !body.event_type) {
      console.error('🔍 [카카오 웹훅] 잘못된 요청 데이터');
      return NextResponse.json(
        { error: 'Invalid webhook data' },
        { status: 400 }
      );
    }
    
    const { event_type, user_id, timestamp } = body;
    
    // 이벤트 타입별 처리
    switch (event_type) {
      case 'USER_LINKED':
        console.log('🔍 [카카오 웹훅] 사용자 계정 연결됨:', { user_id, timestamp });
        // TODO: 사용자 계정 연결 처리 로직
        await handleUserLinked(user_id, timestamp);
        break;
        
      case 'USER_UNLINKED':
        console.log('🔍 [카카오 웹훅] 사용자 계정 연결 해제됨:', { user_id, timestamp });
        // TODO: 사용자 계정 연결 해제 처리 로직
        await handleUserUnlinked(user_id, timestamp);
        break;
        
      case 'ACCOUNT_STATUS_CHANGED':
        console.log('🔍 [카카오 웹훅] 계정 상태 변경됨:', { user_id, timestamp });
        // TODO: 계정 상태 변경 처리 로직
        await handleAccountStatusChanged(user_id, timestamp, body);
        break;
        
      default:
        console.log('🔍 [카카오 웹훅] 알 수 없는 이벤트 타입:', event_type);
        break;
    }
    
    // 웹훅 처리 성공 응답
    return NextResponse.json({ 
      success: true, 
      message: 'Webhook processed successfully',
      event_type,
      user_id,
      timestamp 
    });
    
  } catch (error) {
    console.error('🔍 [카카오 웹훅] 처리 중 오류 발생:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET 요청도 처리 (웹훅 URL 검증용)
export async function GET() {
  return NextResponse.json({ 
    message: 'Kakao Account Webhook Endpoint',
    status: 'active',
    timestamp: new Date().toISOString()
  });
}

// 사용자 계정 연결 처리
async function handleUserLinked(userId: string, timestamp: string) {
  try {
    console.log('🔍 [카카오 웹훅] 사용자 연결 처리 시작:', userId);
    
    // TODO: 데이터베이스에 사용자 연결 상태 업데이트
    // 예: Supabase나 다른 DB에 사용자 정보 저장/업데이트
    
    // 로그 기록
    console.log('🔍 [카카오 웹훅] 사용자 연결 처리 완료:', userId);
    
  } catch (error) {
    console.error('🔍 [카카오 웹훅] 사용자 연결 처리 실패:', error);
  }
}

// 사용자 계정 연결 해제 처리
async function handleUserUnlinked(userId: string, timestamp: string) {
  try {
    console.log('🔍 [카카오 웹훅] 사용자 연결 해제 처리 시작:', userId);
    
    // TODO: 데이터베이스에서 사용자 연결 상태 제거
    // 예: 연결된 카카오 계정 정보 삭제
    
    // 로그 기록
    console.log('🔍 [카카오 웹훅] 사용자 연결 해제 처리 완료:', userId);
    
  } catch (error) {
    console.error('🔍 [카카오 웹훅] 사용자 연결 해제 처리 실패:', error);
  }
}

// 계정 상태 변경 처리
async function handleAccountStatusChanged(userId: string, timestamp: string, data: any) {
  try {
    console.log('🔍 [카카오 웹훅] 계정 상태 변경 처리 시작:', { userId, data });
    
    // TODO: 계정 상태 변경에 따른 처리 로직
    // 예: 계정 정지, 제재 등의 상태 업데이트
    
    // 로그 기록
    console.log('🔍 [카카오 웹훅] 계정 상태 변경 처리 완료:', userId);
    
  } catch (error) {
    console.error('🔍 [카카오 웹훅] 계정 상태 변경 처리 실패:', error);
  }
}
