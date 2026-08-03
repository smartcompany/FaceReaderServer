import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import convert from 'heic-convert';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 간단한 고유 ID 생성 함수
function generateUniqueId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

// HEIC 파일인지 확인하는 함수
function isHEICBuffer(buffer: Buffer): boolean {
  // HEIC 파일은 'ftyp' 시그니처를 가지며, 그 뒤에 'heic' 또는 'mif1'이 옴
  const signature = buffer.toString('ascii', 4, 12);
  return signature.includes('heic') || signature.includes('mif1');
}

// HEIC를 JPEG로 변환하는 함수
async function convertHEICToJPEG(buffer: Buffer): Promise<Buffer> {
  try {
    console.log('🔄 HEIC 파일 감지, JPEG로 변환 중...');
    const outputBuffer = await convert({
      buffer: buffer,
      format: 'JPEG',
      quality: 0.9
    });
    console.log('✅ HEIC → JPEG 변환 완료');
    return Buffer.from(outputBuffer);
  } catch (error) {
    console.error('❌ HEIC 변환 실패:', error);
    throw new Error('HEIC 파일 변환에 실패했습니다.');
  }
}

export async function POST(req: Request) {
  try {
    console.log('=== user-profile POST 요청 시작 ===');
    
    // multipart/form-data 처리
    const formData = await req.formData();
    console.log('formData 전체:', formData);
    
    // 각 필드별로 상세 로깅
    const userId = formData.get('userId') as string;
    const email = formData.get('email') as string;
    const nickname = formData.get('nickname') as string;
    const gender = formData.get('gender') as string;
    const age = formData.get('age') as string;
    const region = formData.get('region') as string;
    const bioRaw = formData.get('bio') as string | null;
    const bio = bioRaw != null ? bioRaw.trim() : null;
    
    console.log('추출된 필드들:');
    console.log('  userId:', userId);
    console.log('  email:', email);
    console.log('  nickname:', nickname);
    console.log('  gender:', gender);
    console.log('  age:', age);
    console.log('  region:', region);
    console.log('  bio:', bio ? `${bio.length} chars` : '없음');
    
    // 이미지 파일 처리
    const photoFile = formData.get('photo') as File | null;
    let photoUrl = formData.get('photoUrl') as string || null;
    
    console.log('이미지 파일 정보:');
    console.log('  photoFile:', photoFile ? `${photoFile.name} (${photoFile.size} bytes)` : '없음');
    console.log('  photoUrl:', photoUrl);

    // 필수 필드 검증
    if (!userId || !email) {
      return NextResponse.json({ 
        success: false, 
        message: '필수 필드가 누락되었습니다.',
        error: 'userId와 email은 필수입니다.' 
      }, { status: 400 });
    }

    // 이미지 파일이 있으면 Supabase Storage에 업로드
    if (photoFile && photoFile.size > 0) {
      try {
        console.log('이미지 파일 업로드 시작:', photoFile.name, photoFile.size);
        
        // 파일을 버퍼로 변환
        const arrayBuffer = await photoFile.arrayBuffer();
        let buffer = Buffer.from(arrayBuffer);
        let contentType = photoFile.type;
        let fileExtension = photoFile.name.split('.').pop();
        
        // HEIC 파일인지 확인하고 변환
        if (isHEICBuffer(buffer)) {
          console.log('📸 HEIC 파일 감지됨, JPEG로 변환 시작');
          buffer = await convertHEICToJPEG(buffer);
          contentType = 'image/jpeg';
          fileExtension = 'jpg';
          console.log('✅ HEIC → JPEG 변환 완료');
        }
        
        const fileName = `profiles/${userId}_${generateUniqueId()}.${fileExtension}`;
        
        // Supabase Storage에 업로드
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('face-reader')
          .upload(fileName, buffer, {
            contentType: contentType,
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error('이미지 업로드 실패:', uploadError);
          throw new Error(`이미지 업로드 실패: ${uploadError.message}`);
        }

        // 업로드된 이미지의 공개 URL 생성
        const { data: urlData } = supabase.storage
          .from('face-reader')
          .getPublicUrl(fileName);

        photoUrl = urlData.publicUrl;
        console.log('이미지 업로드 성공, URL:', photoUrl);
        
      } catch (uploadError) {
        console.error('이미지 업로드 중 오류:', uploadError);
        return NextResponse.json({ 
          success: false, 
          message: '이미지 업로드에 실패했습니다.',
          error: uploadError instanceof Error ? uploadError.message : '알 수 없는 오류'
        }, { status: 500 });
      }
    }

    // 기존 user_data와 병합 (bio 등 추가 필드 보존)
    const { data: existingRow } = await supabase
      .from('face_reader_user_data')
      .select('user_data')
      .eq('user_id', userId)
      .maybeSingle();

    const existingUserData =
      existingRow?.user_data && typeof existingRow.user_data === 'object'
        ? existingRow.user_data
        : {};

    const nextUserData = {
      ...existingUserData,
      email: email,
      nickname: nickname,
      gender: gender,
      age: age,
      region: region,
      photoUrl: photoUrl,
      bio: bio && bio.length > 0 ? bio : null,
    };

    // Supabase에 사용자 프로필 데이터 저장
    const { data, error } = await supabase
      .from('face_reader_user_data')
      .upsert(
        {
          user_id: userId,
          user_data: nextUserData,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'user_id' }
      )
      .select();

    console.log('Supabase upsert result:', data, error);

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ 
        success: false, 
        message: '데이터베이스 저장에 실패했습니다.',
        error: error.message 
      }, { status: 500 });
    }
    
    if (!data || data.length == 0) {
      return NextResponse.json({ 
        success: false, 
        message: '데이터 저장 후 조회에 실패했습니다.',
        error: '저장된 데이터를 찾을 수 없습니다.' 
      }, { status: 500 });
    }

    // 성공 응답
    const successResponse = {
      success: true,
      message: '사용자 프로필이 성공적으로 저장되었습니다.',
      data: {
        userId: data[0].user_id,
        provider: data[0].provider,
        email: email,
        nickname: nickname,
        gender: gender,
        age: age,
        region: region,
        photoUrl: photoUrl,
        bio: nextUserData.bio,
        createdAt: data[0].user_data.createdAt,
        updatedAt: data[0].user_data.updatedAt,
      }
    };
    
    console.log('=== 성공 응답 전송 ===');
    console.log('응답 데이터:', JSON.stringify(successResponse, null, 2));
    
    return NextResponse.json(successResponse, { status: 201 });

  } catch (e: any) {
    console.error('=== user-profile POST 에러 발생 ===');
    console.error('에러 타입:', typeof e);
    console.error('에러 객체:', e);
    console.error('에러 메시지:', e.message);
    console.error('에러 스택:', e.stack);
    
    let errorMessage = '알 수 없는 오류가 발생했습니다.';
    if (e.message) {
      errorMessage = e.message;
    } else if (typeof e === 'string') {
      errorMessage = e;
    }
    
    return NextResponse.json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: errorMessage,
      details: {
        type: typeof e,
        message: e.message,
        stack: e.stack
      }
    }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        message: 'userId 파라미터가 필요합니다.',
        error: 'userId를 쿼리 파라미터로 전달해주세요.' 
      }, { status: 400 });
    }

    console.log('user-profile GET request for userId:', userId);

    // Supabase에서 사용자 프로필 데이터 조회
    const { data, error } = await supabase
      .from('face_reader_user_data')
      .select('user_id, user_data, updated_at')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // 데이터가 없는 경우
        return NextResponse.json({ 
          success: false, 
          message: '사용자를 찾을 수 없습니다.',
          error: '해당 userId로 등록된 사용자가 없습니다.' 
        }, { status: 404 });
      }
      
      console.error('Supabase query error:', error);
      return NextResponse.json({ 
        success: false, 
        message: '데이터베이스 조회에 실패했습니다.',
        error: error.message 
      }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ 
        success: false, 
        message: '사용자 데이터를 찾을 수 없습니다.',
        error: '데이터가 null입니다.' 
      }, { status: 404 });
    }

    // 성공 응답
    return NextResponse.json({
      success: true,
      data: {
        userId: data.user_id,
        email: data.user_data.email,
        nickname: data.user_data.nickname,
        gender: data.user_data.gender,
        age: data.user_data.age,
        region: data.user_data.region,
        photoUrl: data.user_data.photoUrl,
        bio: data.user_data.bio ?? null,
        createdAt: data.user_data.createdAt,
        updatedAt: data.user_data.updatedAt,
      }
    });

  } catch (e: any) {
    console.error('Server error:', e);
    return NextResponse.json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: e.message 
    }, { status: 500 });
  }
}