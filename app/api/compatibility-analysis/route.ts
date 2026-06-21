import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { getLanguageFromHeaders, getLanguageSpecificPrompt, openAIConfig } from '../_helpers';
import { shouldUseDummyData, loadDummyData } from '../../../utils/dummy-settings';
import convert from 'heic-convert';
import sharp from 'sharp';
import compatibilityPrompt from './compatibility-analysis_normal.txt';

const STORAGE_BUCKET = "face-reader";
const OPENAI_IMAGE_MAX_SIZE = 512;
const OPENAI_JPEG_QUALITY = 80;

function logCompatibility(
  step: string,
  message: string,
  data?: Record<string, unknown>
) {
  if (data) {
    console.log(`[Compatibility][${step}] ${message}`, data);
    return;
  }

  console.log(`[Compatibility][${step}] ${message}`);
}

function summarizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url.slice(0, 120);
  }
}

function getErrorDetails(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
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

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 환경 변수 설정
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY;

// 환경 변수 검증
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ [Compatibility] 환경 변수가 설정되지 않음:', {
    SUPABASE_URL: SUPABASE_URL ? '설정됨' : '설정되지 않음',
    SUPABASE_KEY: SUPABASE_KEY ? '설정됨' : '설정되지 않음'
  });
}

// Supabase 클라이언트 초기화
const supabase = createClient(SUPABASE_URL || '', SUPABASE_KEY || '');

function parseSupabaseStoragePath(
  url: string
): { bucket: string; path: string } | null {
  const match = url.match(
    /\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/([^?]+)/
  );

  if (!match) {
    return null;
  }

  return {
    bucket: match[1],
    path: decodeURIComponent(match[2]),
  };
}

function getFileExtension(contentType: string, fallback = 'jpg'): string {
  const extensionMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };

  return extensionMap[contentType.toLowerCase()] || fallback;
}

async function processImageBuffer(
  buffer: Buffer,
  contentType: string,
  fileExt: string
): Promise<{ buffer: Buffer; contentType: string; fileExt: string }> {
  if (isHEICBuffer(buffer)) {
    console.log('📸 HEIC 파일 감지, JPEG로 변환 시작');
    return {
      buffer: await convertHEICToJPEG(buffer),
      contentType: 'image/jpeg',
      fileExt: 'jpg',
    };
  }

  return { buffer, contentType, fileExt };
}

async function downloadImageBuffer(
  imageUrl: string,
  label: string
): Promise<{ buffer: Buffer; contentType: string; fileExt: string }> {
  logCompatibility('DOWNLOAD', `${label} 다운로드 시작`, {
    url: summarizeUrl(imageUrl),
  });

  const storagePath = parseSupabaseStoragePath(imageUrl);
  logCompatibility('DOWNLOAD', `${label} URL 파싱 결과`, {
    isSupabaseStorage: Boolean(storagePath),
    bucket: storagePath?.bucket,
    path: storagePath?.path,
  });

  if (storagePath) {
    const { data, error } = await supabase.storage
      .from(storagePath.bucket)
      .download(storagePath.path);

    if (error || !data) {
      logCompatibility('DOWNLOAD', `${label} Supabase 다운로드 실패`, {
        bucket: storagePath.bucket,
        path: storagePath.path,
        error: error?.message || '데이터 없음',
      });
      throw new Error(
        `Supabase 이미지 다운로드 실패 (${label}): ${error?.message || '데이터 없음'}`
      );
    }

    const arrayBuffer = await data.arrayBuffer();
    const contentType = data.type || 'image/jpeg';
    const fileExt =
      storagePath.path.split('.').pop() || getFileExtension(contentType);
    const processed = await processImageBuffer(
      Buffer.from(arrayBuffer),
      contentType,
      fileExt
    );

    logCompatibility('DOWNLOAD', `${label} Supabase 다운로드 완료`, {
      bytes: processed.buffer.length,
      contentType: processed.contentType,
      fileExt: processed.fileExt,
    });

    return processed;
  }

  const response = await fetch(imageUrl);

  if (!response.ok) {
    logCompatibility('DOWNLOAD', `${label} HTTP 다운로드 실패`, {
      status: response.status,
      statusText: response.statusText,
      url: summarizeUrl(imageUrl),
    });
    throw new Error(
      `이미지 다운로드 실패 (${label}): HTTP ${response.status}`
    );
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const fileExt = getFileExtension(contentType);
  const arrayBuffer = await response.arrayBuffer();
  const processed = await processImageBuffer(
    Buffer.from(arrayBuffer),
    contentType,
    fileExt
  );

  logCompatibility('DOWNLOAD', `${label} HTTP 다운로드 완료`, {
    bytes: processed.buffer.length,
    contentType: processed.contentType,
    fileExt: processed.fileExt,
  });

  return processed;
}

async function uploadCompatibilityImage(
  buffer: Buffer,
  contentType: string,
  fileExt: string,
  personLabel: 'person1' | 'person2'
): Promise<string> {
  const fileName = `compatibility-analysis/${Date.now()}-${personLabel}.${fileExt}`;
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(fileName, buffer, {
      contentType,
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`${personLabel} 이미지 업로드 실패: ${uploadError.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(fileName);

  return publicUrl;
}

function toDataUrl(buffer: Buffer, contentType: string): string {
  return `data:${contentType};base64,${buffer.toString('base64')}`;
}

async function resizeImageForOpenAI(
  buffer: Buffer,
  contentType: string
): Promise<{ buffer: Buffer; contentType: string }> {
  const metadata = await sharp(buffer).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  const needsResize =
    width > OPENAI_IMAGE_MAX_SIZE || height > OPENAI_IMAGE_MAX_SIZE;
  const isAlreadySmallJpeg =
    !needsResize && contentType.toLowerCase() === 'image/jpeg';

  if (isAlreadySmallJpeg) {
    return { buffer, contentType };
  }

  const resized = await sharp(buffer)
    .rotate()
    .resize(OPENAI_IMAGE_MAX_SIZE, OPENAI_IMAGE_MAX_SIZE, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: OPENAI_JPEG_QUALITY })
    .toBuffer();

  console.log(
    `OpenAI용 이미지 리사이즈: ${width}x${height} -> max ${OPENAI_IMAGE_MAX_SIZE}px, outputBytes=${resized.length}`
  );

  return { buffer: resized, contentType: 'image/jpeg' };
}

async function prepareImageFromUrl(
  imageUrl: string,
  label: 'person1' | 'person2'
): Promise<{ publicUrl: string; openAiImageUrl: string }> {
  const processedImage = await downloadImageBuffer(imageUrl, label);
  const openAiImage = await resizeImageForOpenAI(
    processedImage.buffer,
    processedImage.contentType
  );
  const openAiImageUrl = toDataUrl(openAiImage.buffer, openAiImage.contentType);

  logCompatibility('PREPARE_URL', `${label} OpenAI payload 준비 완료`, {
    sourceUrl: summarizeUrl(imageUrl),
    sourceBytes: processedImage.buffer.length,
    openAiBytes: openAiImage.buffer.length,
    dataUrlLength: openAiImageUrl.length,
  });

  return {
    publicUrl: imageUrl,
    openAiImageUrl,
  };
}

async function prepareImageFromFile(
  file: File,
  personLabel: 'person1' | 'person2'
): Promise<{ publicUrl: string; openAiImageUrl: string }> {
  const bytes = await file.arrayBuffer();
  const processedImage = await processImageBuffer(
    Buffer.from(bytes),
    file.type || 'image/jpeg',
    file.name.split('.').pop() || 'jpg'
  );
  const openAiImage = await resizeImageForOpenAI(
    processedImage.buffer,
    processedImage.contentType
  );

  const publicUrl = await uploadCompatibilityImage(
    processedImage.buffer,
    processedImage.contentType,
    processedImage.fileExt,
    personLabel
  );

  const openAiImageUrl = toDataUrl(openAiImage.buffer, openAiImage.contentType);

  logCompatibility('PREPARE_FILE', `${personLabel} 파일 준비 완료`, {
    fileName: file.name,
    fileSize: file.size,
    sourceBytes: processedImage.buffer.length,
    openAiBytes: openAiImage.buffer.length,
    dataUrlLength: openAiImageUrl.length,
    publicUrl: summarizeUrl(publicUrl),
  });

  return {
    publicUrl,
    openAiImageUrl,
  };
}

// 프롬프트 로드(로컬 import 사용)
async function loadPrompt(language: string, _platform?: string): Promise<string> {
  try {
    return getLanguageSpecificPrompt(compatibilityPrompt as unknown as string, language);
  } catch (error) {
    console.error('프롬프트 파일 읽기 오류:', error);
    // 기본 프롬프트 반환
    const fallbackPrompt = '당신은 전문적인 분석가입니다. 두 사람의 얼굴 사진을 분석하여 관계를 분석해주세요.';
    return getLanguageSpecificPrompt(fallbackPrompt, language);
  }
}

export async function POST(request: NextRequest) {
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const startedAt = Date.now();
  let currentStep = 'START';

  logCompatibility(currentStep, '요청 수신', {
    requestId,
    hasOpenAiKey: Boolean(process.env.OPENAI_API_KEY),
    hasSupabaseUrl: Boolean(SUPABASE_URL),
    hasSupabaseKey: Boolean(SUPABASE_KEY),
    openAiModel: openAIConfig.model,
  });

  try {
    currentStep = 'CHECK_DUMMY';
    const useDummy = await shouldUseDummyData();
    logCompatibility(currentStep, '더미 데이터 설정 확인', { useDummy });

    if (useDummy) {
      logCompatibility('LOAD_DUMMY', '더미 데이터 모드로 궁합 분석 실행');
      const dummyData = await loadDummyData('compatibility-analysis.json');
      return NextResponse.json(dummyData);
    }

    currentStep = 'PARSE_REQUEST';
    const language = getLanguageFromHeaders(request);
    const formData = await request.formData();
    const image1File = formData.get('image1') as File | null;
    const image2File = formData.get('image2') as File | null;
    const image1Url = formData.get('image1Url') as string | null;
    const image2Url = formData.get('image2Url') as string | null;
    const platform = formData.get('platform') as string | null;

    logCompatibility(currentStep, '요청 파싱 완료', {
      requestId,
      language,
      platform,
      mode:
        image1Url && image2Url
          ? 'url'
          : image1File && image2File
            ? 'file'
            : 'invalid',
      image1Url: image1Url ? summarizeUrl(image1Url) : null,
      image2Url: image2Url ? summarizeUrl(image2Url) : null,
      image1FileName: image1File?.name ?? null,
      image1FileSize: image1File?.size ?? null,
      image2FileName: image2File?.name ?? null,
      image2FileSize: image2File?.size ?? null,
    });
    
    let publicUrl1: string;
    let publicUrl2: string;
    let openAiImageUrl1: string;
    let openAiImageUrl2: string;

    if (image1Url && image2Url) {
      currentStep = 'PREPARE_IMAGE1_URL';
      const image1 = await prepareImageFromUrl(image1Url, 'person1');

      currentStep = 'PREPARE_IMAGE2_URL';
      const image2 = await prepareImageFromUrl(image2Url, 'person2');

      publicUrl1 = image1.publicUrl;
      publicUrl2 = image2.publicUrl;
      openAiImageUrl1 = image1.openAiImageUrl;
      openAiImageUrl2 = image2.openAiImageUrl;
    } else if (image1File && image2File) {
      currentStep = 'PREPARE_IMAGE1_FILE';
      const image1 = await prepareImageFromFile(image1File, 'person1');

      currentStep = 'PREPARE_IMAGE2_FILE';
      const image2 = await prepareImageFromFile(image2File, 'person2');

      publicUrl1 = image1.publicUrl;
      publicUrl2 = image2.publicUrl;
      openAiImageUrl1 = image1.openAiImageUrl;
      openAiImageUrl2 = image2.openAiImageUrl;
    } else {
      logCompatibility('VALIDATION', '필수 이미지 누락', { requestId });
      return NextResponse.json(
        {
          error: '두 개의 이미지 파일(image1, image2) 또는 두 개의 이미지 URL(image1Url, image2Url)이 필요합니다.',
          step: 'VALIDATION',
          requestId,
        },
        { status: 400 }
      );
    }

    currentStep = 'LOAD_PROMPT';
    const prompt = await loadPrompt(language, platform);
    logCompatibility(currentStep, '프롬프트 로드 완료', {
      promptLength: prompt.length,
    });
    
    currentStep = 'OPENAI_REQUEST';
    logCompatibility(currentStep, 'OpenAI API 호출 시작', {
      model: openAIConfig.model,
      maxCompletionTokens: 12000,
      reasoningEffort: 'minimal',
      image1DataUrlLength: openAiImageUrl1.length,
      image2DataUrlLength: openAiImageUrl2.length,
    });

    const response = await openai.chat.completions.create({
      ...openAIConfig,
      max_completion_tokens: 12000,
      reasoning_effort: 'minimal',
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt
            },
            {
              type: "image_url",
              image_url: {
                url: openAiImageUrl1,
                detail: "low",
              }
            },
            {
              type: "image_url",
              image_url: {
                url: openAiImageUrl2,
                detail: "low",
              }
            }
          ]
        }
      ],
      response_format: {
        type: "json_object"
      },
    });

    currentStep = 'OPENAI_RESPONSE';
    const choice = response.choices[0];
    const usage = response.usage as
      | (typeof response.usage & {
          completion_tokens_details?: { reasoning_tokens?: number };
        })
      | undefined;

    logCompatibility(currentStep, 'OpenAI API 호출 완료', {
      finishReason: choice?.finish_reason,
      hasContent: Boolean(choice?.message?.content),
      contentLength: choice?.message?.content?.length ?? 0,
      refusal: choice?.message?.refusal ?? null,
      promptTokens: usage?.prompt_tokens,
      completionTokens: usage?.completion_tokens,
      reasoningTokens: usage?.completion_tokens_details?.reasoning_tokens,
      totalTokens: usage?.total_tokens,
    });

    const compatibilityResult = choice?.message?.content;
    
    if (!compatibilityResult) {
      logCompatibility('OPENAI_EMPTY', 'OpenAI 응답 본문 없음', {
        requestId,
        finishReason: choice?.finish_reason,
        refusal: choice?.message?.refusal ?? null,
        promptTokens: usage?.prompt_tokens,
        completionTokens: usage?.completion_tokens,
        reasoningTokens: usage?.completion_tokens_details?.reasoning_tokens,
        totalTokens: usage?.total_tokens,
      });
      return NextResponse.json(
        {
          error: 'AI 궁합 분석 결과를 생성할 수 없습니다.',
          details:
            choice?.finish_reason === 'length'
              ? '모델 출력 토큰 한도에 도달했습니다. reasoning 토큰이 출력을 모두 사용했을 수 있습니다.'
              : choice?.message?.refusal ||
                'OpenAI가 빈 응답을 반환했습니다.',
          step: 'OPENAI_EMPTY',
          requestId,
          finishReason: choice?.finish_reason ?? null,
          reasoningTokens: usage?.completion_tokens_details?.reasoning_tokens ?? null,
        },
        { status: 500 }
      );
    }

    currentStep = 'PARSE_JSON';
    let parsedCompatibility;
    try {
      logCompatibility(currentStep, 'AI 응답 JSON 파싱 시작', {
        responseLength: compatibilityResult.length,
        responsePreview: compatibilityResult.slice(0, 300),
      });
      
      const jsonMatch = compatibilityResult.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonString = jsonMatch ? jsonMatch[1] : compatibilityResult;
      const cleanJsonString = jsonString.trim().replace(/\n/g, ' ').replace(/\r/g, '');
      
      parsedCompatibility = JSON.parse(cleanJsonString);
      
      const requiredFields = [
        'overall_score', 'personality_compatibility', 'emotional_compatibility',
        'social_compatibility', 'communication_compatibility', 'long_term_prospects',
        'improvement_suggestions', 'precautions'
      ];
      
      const defaultStructure = {
        overall_score: 0,
        personality_compatibility: '분석 결과를 확인할 수 없습니다.',
        emotional_compatibility: '분석 결과를 확인할 수 없습니다.',
        social_compatibility: '분석 결과를 확인할 수 없습니다.',
        communication_compatibility: '분석 결과를 확인할 수 없습니다.',
        long_term_prospects: '분석 결과를 확인할 수 없습니다.',
        improvement_suggestions: '분석 결과를 확인할 수 없습니다.',
        precautions: '분석 결과를 확인할 수 없습니다.'
      };
      
      const missingFields = requiredFields.filter(field => 
        !parsedCompatibility[field]
      );
      
      if (missingFields.length > 0) {
        logCompatibility('PARSE_JSON', '필수 필드 누락, 기본값 사용', {
          missingFields,
        });
        parsedCompatibility = defaultStructure;
      } else {
        logCompatibility('PARSE_JSON', 'JSON 파싱 성공');
      }
      
    } catch (parseError) {
      logCompatibility('PARSE_JSON', 'JSON 파싱 실패', {
        error: getErrorDetails(parseError),
        responsePreview: compatibilityResult.slice(0, 500),
      });

      return NextResponse.json(
        { 
          error: '궁합 분석 중 오류가 발생했습니다.',
          details: compatibilityResult.slice(0, 1000),
          step: 'PARSE_JSON',
          requestId,
        },
        { status: 500 }
      );
    }

    logCompatibility('SUCCESS', '궁합 분석 완료', {
      requestId,
      elapsedMs: Date.now() - startedAt,
    });

    return NextResponse.json({
      success: true,
      compatibility: parsedCompatibility,
      images: {
        person1: publicUrl1,
        person2: publicUrl2
      },
      timestamp: new Date().toISOString(),
      requestId,
    });

  } catch (error) {
    const details = getErrorDetails(error);
    const openAiError =
      typeof error === 'object' &&
      error !== null &&
      'status' in error &&
      'message' in error
        ? {
            status: (error as { status?: number }).status,
            message: (error as { message?: string }).message,
            code:
              'code' in error
                ? (error as { code?: string }).code
                : undefined,
          }
        : null;

    logCompatibility(currentStep, '요청 처리 실패', {
      requestId,
      elapsedMs: Date.now() - startedAt,
      details,
      openAiError,
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    return NextResponse.json(
      { 
        error: '궁합 분석 중 오류가 발생했습니다.',
        details,
        step: currentStep,
        requestId,
        openAiError,
      },
      { status: 500 }
    );
  }
}

// GET 요청 처리 (API 정보 제공)
export async function GET() {
  return NextResponse.json({
    message: '궁합 분석 API',
    description: '두 사람의 이미지 파일을 업로드하여 AI 기반 궁합 분석을 받을 수 있습니다.',
    usage: 'POST /api/compatibility-analysis with multipart/form-data containing image1 and image2 files',
    requestFormat: {
      image1: 'File (첫 번째 사람의 이미지 파일)',
      image2: 'File (두 번째 사람의 이미지 파일)'
    },
    features: [
      'URL 모드: 기존 Storage URL 재사용 (재업로드 없음)',
      'OpenAI Vision detail=low + 512px 리사이즈로 토큰 절감',
      '파일 업로드 모드: Supabase Storage 저장 후 분석',
      '전반적인 궁합 점수 (0-100점)',
      '성격적 궁합 분석',
      '감정적 궁합 분석',
      '대인관계 궁합 분석',
      '커뮤니케이션 궁합 분석',
      '장기적 관계 전망',
      '궁합 개선 방안',
      '주의사항 및 갈등 해결 방안'
    ],
    responseFormat: {
      success: 'boolean',
      compatibility: 'object (궁합 분석 결과)',
      images: 'object (업로드된 이미지 URL)',
      timestamp: 'string (분석 완료 시간)'
    }
  });
}
