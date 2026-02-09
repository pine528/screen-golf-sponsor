import { PrismaClient } from '@prisma/client';
import { NotFoundError, BadRequestError } from '../utils/errors';
import axios from 'axios';

const prisma = new PrismaClient();

// GPU 서버 사용 여부 (환경변수로 제어)
const USE_GPU_SERVER = process.env.USE_GPU_SERVER === 'true';

// Google Vision API 응답 타입
interface VisionLogoAnnotation {
  mid?: string;
  description: string;
  score: number;
  boundingPoly: {
    vertices: Array<{ x: number; y: number }>;
  };
}

interface VisionResponse {
  responses: Array<{
    logoAnnotations?: VisionLogoAnnotation[];
    error?: { code: number; message: string };
  }>;
}

// 로고 검출 결과 타입
interface LogoDetectionResult {
  brandId: string;
  brandName: string;
  confidence: number;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  bboxArea: number;
  areaRatio: number;
}

// 슬롯 타입 매핑 설정
const SLOT_MAPPING_RULES = [
  { yRatio: [0, 0.15], xRatio: [0.3, 0.7], slot: 'CAP_FRONT' },
  { yRatio: [0.15, 0.35], xRatio: [0, 0.35], slot: 'SLEEVE_L' },
  { yRatio: [0.15, 0.35], xRatio: [0.65, 1], slot: 'SLEEVE_R' },
  { yRatio: [0.2, 0.45], xRatio: [0.25, 0.5], slot: 'CHEST_L' },
  { yRatio: [0.2, 0.45], xRatio: [0.5, 0.75], slot: 'CHEST_R' },
  { yRatio: [0.1, 0.25], xRatio: [0.35, 0.65], slot: 'COLLAR' },
];

class LogoDetectService {
  private visionApiKey: string | undefined;
  private visionApiUrl = 'https://vision.googleapis.com/v1/images:annotate';

  constructor() {
    this.visionApiKey = process.env.GOOGLE_VISION_API_KEY;
  }

  /**
   * 단일 프레임에서 로고 검출 (CLIP 임베딩 기반)
   */
  async detectLogosInFrame(
    frameId: string,
    brandIds?: string[],
    options: {
      useEmbedding?: boolean;  // true: CLIP 임베딩, false: Google Vision
      threshold?: number;      // 유사도 임계값 (기본 0.5)
    } = {}
  ): Promise<LogoDetectionResult[]> {
    // 환경변수로 threshold 기본값 설정 가능
    const defaultThreshold = parseFloat(process.env.LOGO_DETECT_THRESHOLD || '0.5');
    const { useEmbedding = true, threshold = defaultThreshold } = options;

    const frame = await prisma.vodFrame.findUnique({
      where: { id: frameId },
      include: {
        vodAsset: {
          include: {
            campaign: {
              select: { brandId: true },
            },
          },
        },
      },
    });

    if (!frame) {
      throw new NotFoundError('프레임을 찾을 수 없습니다.');
    }

    // 검출할 브랜드 목록 (지정되지 않으면 캠페인 브랜드)
    const targetBrandIds = brandIds || [frame.vodAsset.campaign.brandId];

    // 브랜드 로고 템플릿 조회 (임베딩 포함)
    const logoTemplates = await prisma.logoTemplate.findMany({
      where: {
        brandId: { in: targetBrandIds },
        isActive: true,
      },
      include: {
        brand: {
          select: { id: true, name: true },
        },
      },
    });

    if (logoTemplates.length === 0) {
      console.warn('등록된 로고 템플릿이 없습니다.');
      return [];
    }

    let detections: LogoDetectionResult[] = [];

    // CLIP 임베딩 기반 검출
    if (useEmbedding) {
      // 임베딩이 있는 템플릿만 필터링
      const templatesWithEmbedding = logoTemplates.filter(t => t.embedding);

      if (templatesWithEmbedding.length === 0) {
        console.warn('임베딩이 있는 로고 템플릿이 없습니다. Vision API로 폴백합니다.');
      } else {
        try {
          // 프레임 이미지 경로
          const framePath = frame.thumbnailKey.startsWith('/')
            ? frame.thumbnailKey
            : `/uploads/${frame.thumbnailKey}`;

          // 로고 임베딩 준비
          const logoEmbeddings = templatesWithEmbedding.map(t => ({
            brandId: t.brand.id,
            name: t.brand.name,
            embedding: t.embedding as number[],
          }));

          let clipDetections: any[] = [];

          // GPU 서버 우선 사용
          if (USE_GPU_SERVER) {
            try {
              const { embeddingGpuService } = await import('./embeddingGpu.service');

              // GPU 서버 상태 확인
              const isAvailable = await embeddingGpuService.checkHealth();

              if (isAvailable) {
                console.log('[LogoDetect] Using GPU server for detection');
                clipDetections = await embeddingGpuService.detectLogosInFrame(
                  framePath,
                  logoEmbeddings,
                  { threshold }
                );
              } else {
                throw new Error('GPU server not available');
              }
            } catch (gpuError) {
              console.error('[LogoDetect] GPU server failed:', gpuError);
              // GPU 실패 시 빈 결과 반환 (CPU 폴백 비활성화)
              clipDetections = [];
            }
          } else {
            // CPU 모드 (기존 방식)
            const { embeddingService } = await import('./embedding.service');
            clipDetections = await embeddingService.detectLogosInFrame(
              framePath,
              logoEmbeddings,
              { threshold }
            );
          }

          // 결과 변환
          detections = clipDetections.map(d => ({
            brandId: d.brandId,
            brandName: d.brandName,
            confidence: d.confidence,
            bbox: d.bbox,
            bboxArea: d.bbox.width * d.bbox.height,
            areaRatio: this.calculateAreaRatio(d.bbox),
          }));

          console.log(`[LogoDetect] CLIP detected ${detections.length} logos in frame ${frameId}`);
        } catch (error) {
          console.error('[LogoDetect] CLIP detection failed, falling back to Vision API:', error);
          // 실패 시 Vision API로 폴백
          detections = await this.detectWithVisionApi(frame, logoTemplates);
        }
      }
    } else {
      // Google Vision API 기반 검출
      detections = await this.detectWithVisionApi(frame, logoTemplates);
    }

    // 검출 결과 DB 저장
    if (detections.length > 0) {
      await this.saveDetections(frameId, detections);
    }

    return detections;
  }

  /**
   * Google Vision API 기반 검출 (레거시/폴백)
   */
  private async detectWithVisionApi(
    frame: any,
    logoTemplates: any[]
  ): Promise<LogoDetectionResult[]> {
    // 프레임 이미지 URL 가져오기
    const imageUrl = this.getCloudinaryUrl(frame.thumbnailKey);

    // Google Vision API 호출
    const visionResults = await this.callVisionApi(imageUrl);

    // 검출 결과를 브랜드와 매칭
    return this.matchDetectionsWithBrands(
      visionResults,
      logoTemplates.map(t => ({ id: t.brand.id, name: t.brand.name }))
    );
  }

  /**
   * VOD의 모든 프레임에서 로고 검출 (배치)
   */
  async detectLogosInVod(
    vodId: string,
    options: {
      brandIds?: string[];
      batchSize?: number;
      skipExisting?: boolean;
      threshold?: number;  // 유사도 임계값 (기본 0.5)
    } = {}
  ): Promise<{
    processedFrames: number;
    totalDetections: number;
    errors: number;
  }> {
    const { brandIds, batchSize = 10, skipExisting = true, threshold } = options;

    const vod = await prisma.vodAsset.findUnique({
      where: { id: vodId },
      include: {
        campaign: {
          select: { brandId: true },
        },
      },
    });

    if (!vod) {
      throw new NotFoundError('VOD를 찾을 수 없습니다.');
    }

    // 프레임 목록 조회
    const framesQuery: any = { vodAssetId: vodId };
    if (skipExisting) {
      // 이미 검출된 프레임 제외
      const detectedFrameIds = await prisma.logoDetection.findMany({
        where: {
          frame: { vodAssetId: vodId },
        },
        select: { frameId: true },
        distinct: ['frameId'],
      });
      if (detectedFrameIds.length > 0) {
        framesQuery.id = { notIn: detectedFrameIds.map(d => d.frameId) };
      }
    }

    const frames = await prisma.vodFrame.findMany({
      where: framesQuery,
      orderBy: { timestamp: 'asc' },
    });

    let processedFrames = 0;
    let totalDetections = 0;
    let errors = 0;

    // 배치로 처리
    for (let i = 0; i < frames.length; i += batchSize) {
      const batch = frames.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (frame) => {
          try {
            const detections = await this.detectLogosInFrame(
              frame.id,
              brandIds || [vod.campaign.brandId],
              { threshold }
            );
            processedFrames++;
            totalDetections += detections.length;
          } catch (error) {
            console.error(`프레임 ${frame.id} 검출 실패:`, error);
            errors++;
          }
        })
      );

      // API 레이트 리밋 대응 (배치 간 딜레이)
      if (i + batchSize < frames.length) {
        await this.delay(1000); // 1초 대기
      }
    }

    return {
      processedFrames,
      totalDetections,
      errors,
    };
  }

  /**
   * Google Vision API 호출
   */
  private async callVisionApi(imageUrl: string): Promise<VisionLogoAnnotation[]> {
    if (!this.visionApiKey) {
      console.warn('Google Vision API 키가 설정되지 않았습니다. 더미 데이터 반환.');
      return this.getMockDetections();
    }

    try {
      const response = await axios.post<VisionResponse>(
        `${this.visionApiUrl}?key=${this.visionApiKey}`,
        {
          requests: [
            {
              image: { source: { imageUri: imageUrl } },
              features: [{ type: 'LOGO_DETECTION', maxResults: 10 }],
            },
          ],
        },
        {
          timeout: 30000,
        }
      );

      const result = response.data.responses[0];

      if (result.error) {
        throw new Error(`Vision API Error: ${result.error.message}`);
      }

      return result.logoAnnotations || [];
    } catch (error) {
      console.error('Vision API 호출 실패:', error);
      throw error;
    }
  }

  /**
   * Vision API 결과를 브랜드와 매칭
   */
  private matchDetectionsWithBrands(
    visionResults: VisionLogoAnnotation[],
    brands: Array<{ id: string; name: string }>
  ): LogoDetectionResult[] {
    const detections: LogoDetectionResult[] = [];

    for (const logo of visionResults) {
      // 브랜드명 매칭 (부분 일치 또는 유사도 검사)
      const matchedBrand = brands.find(b =>
        this.isBrandMatch(logo.description, b.name)
      );

      if (matchedBrand) {
        const bbox = this.calculateBoundingBox(logo.boundingPoly.vertices);

        detections.push({
          brandId: matchedBrand.id,
          brandName: matchedBrand.name,
          confidence: logo.score,
          bbox,
          bboxArea: bbox.width * bbox.height,
          areaRatio: this.calculateAreaRatio(bbox),
        });
      }
    }

    return detections;
  }

  /**
   * 브랜드명 매칭 확인
   */
  private isBrandMatch(detected: string, brandName: string): boolean {
    const normalizedDetected = detected.toLowerCase().replace(/\s+/g, '');
    const normalizedBrand = brandName.toLowerCase().replace(/\s+/g, '');

    // 정확히 일치
    if (normalizedDetected === normalizedBrand) return true;

    // 포함 관계
    if (normalizedDetected.includes(normalizedBrand)) return true;
    if (normalizedBrand.includes(normalizedDetected)) return true;

    // 레벤슈타인 거리 기반 유사도 (80% 이상)
    const similarity = this.calculateSimilarity(normalizedDetected, normalizedBrand);
    return similarity >= 0.8;
  }

  /**
   * 바운딩 박스 계산
   */
  private calculateBoundingBox(vertices: Array<{ x: number; y: number }>): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    const xs = vertices.map(v => v.x || 0);
    const ys = vertices.map(v => v.y || 0);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  /**
   * 화면 대비 면적 비율 계산
   */
  private calculateAreaRatio(
    bbox: { width: number; height: number },
    frameWidth: number = 1920,
    frameHeight: number = 1080
  ): number {
    const bboxArea = bbox.width * bbox.height;
    const frameArea = frameWidth * frameHeight;
    return bboxArea / frameArea;
  }

  /**
   * 슬롯 타입 매핑
   */
  mapToSlot(
    bbox: { x: number; y: number; width: number; height: number },
    frameWidth: number = 1920,
    frameHeight: number = 1080
  ): string | null {
    // 바운딩 박스 중심점의 상대 위치 계산
    const centerX = (bbox.x + bbox.width / 2) / frameWidth;
    const centerY = (bbox.y + bbox.height / 2) / frameHeight;

    for (const rule of SLOT_MAPPING_RULES) {
      if (
        centerY >= rule.yRatio[0] &&
        centerY <= rule.yRatio[1] &&
        centerX >= rule.xRatio[0] &&
        centerX <= rule.xRatio[1]
      ) {
        return rule.slot;
      }
    }

    return null; // 매핑되지 않음
  }

  /**
   * 검출 결과 DB 저장
   */
  private async saveDetections(
    frameId: string,
    detections: LogoDetectionResult[]
  ): Promise<void> {
    const frame = await prisma.vodFrame.findUnique({
      where: { id: frameId },
    });

    if (!frame) return;

    await prisma.logoDetection.createMany({
      data: detections.map(d => ({
        frameId,
        brandId: d.brandId,
        confidence: d.confidence,
        bboxX: Math.round(d.bbox.x),
        bboxY: Math.round(d.bbox.y),
        bboxW: Math.round(d.bbox.width),
        bboxH: Math.round(d.bbox.height),
        bboxArea: d.bboxArea,
        areaRatio: d.areaRatio,
        slotType: this.mapToSlot(d.bbox),
      })),
    });
  }

  /**
   * 로고 템플릿 등록 (CLIP 임베딩 자동 생성)
   */
  async createLogoTemplate(
    brandId: string,
    data: {
      name: string;
      fileKey: string;
      fileUrl?: string;
      variant?: string;
    }
  ) {
    // 브랜드 존재 확인
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
    });

    if (!brand) {
      throw new NotFoundError('브랜드를 찾을 수 없습니다.');
    }

    // CLIP 임베딩 계산 (백그라운드에서 비동기로 처리)
    let embedding: number[] | null = null;
    try {
      const { embeddingService } = await import('./embedding.service');
      const imagePath = data.fileUrl || `/uploads/${data.fileKey}`;
      embedding = await embeddingService.getImageEmbedding(imagePath);
      console.log(`[LogoDetect] Embedding computed for logo template: ${data.name} (${embedding.length} dimensions)`);
    } catch (error) {
      console.error('[LogoDetect] Failed to compute embedding:', error);
      // 임베딩 실패해도 템플릿은 생성 (나중에 재계산 가능)
    }

    return prisma.logoTemplate.create({
      data: {
        brandId,
        name: data.name,
        fileKey: data.fileKey,
        fileUrl: data.fileUrl,
        variant: data.variant,
        embedding: embedding ? embedding : undefined,
      },
    });
  }

  /**
   * 기존 로고 템플릿의 임베딩 재계산
   */
  async recomputeEmbedding(templateId: string): Promise<void> {
    const template = await prisma.logoTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new NotFoundError('로고 템플릿을 찾을 수 없습니다.');
    }

    try {
      const { embeddingService } = await import('./embedding.service');
      const imagePath = template.fileUrl || `/uploads/${template.fileKey}`;
      const embedding = await embeddingService.getImageEmbedding(imagePath);

      await prisma.logoTemplate.update({
        where: { id: templateId },
        data: { embedding },
      });

      console.log(`[LogoDetect] Embedding recomputed for: ${template.name}`);
    } catch (error) {
      console.error('[LogoDetect] Failed to recompute embedding:', error);
      throw error;
    }
  }

  /**
   * 로고 템플릿 목록 조회
   */
  async listLogoTemplates(brandId: string) {
    return prisma.logoTemplate.findMany({
      where: { brandId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 로고 템플릿 삭제
   */
  async deleteLogoTemplate(templateId: string): Promise<void> {
    const template = await prisma.logoTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new NotFoundError('로고 템플릿을 찾을 수 없습니다.');
    }

    await prisma.logoTemplate.delete({
      where: { id: templateId },
    });
  }

  /**
   * 문자열 유사도 계산 (레벤슈타인)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;

    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;

    const matrix: number[][] = [];

    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    const distance = matrix[len1][len2];
    return 1 - distance / Math.max(len1, len2);
  }

  /**
   * Cloudinary URL 생성
   */
  private getCloudinaryUrl(publicId: string): string {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    return `https://res.cloudinary.com/${cloudName}/image/upload/${publicId}`;
  }

  /**
   * 딜레이 유틸리티
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 목 데이터 (API 키 없을 때)
   */
  private getMockDetections(): VisionLogoAnnotation[] {
    return [
      {
        description: 'Sample Brand',
        score: 0.85,
        boundingPoly: {
          vertices: [
            { x: 100, y: 100 },
            { x: 200, y: 100 },
            { x: 200, y: 150 },
            { x: 100, y: 150 },
          ],
        },
      },
    ];
  }
}

export const logoDetectService = new LogoDetectService();
