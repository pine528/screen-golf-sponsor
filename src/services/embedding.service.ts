/**
 * CLIP 임베딩 서비스 (최적화 버전)
 * 2단계 검출: 빠른 후보 탐색 → 정밀 CLIP 비교
 */
import { pipeline, env } from '@xenova/transformers';
import { Jimp, JimpMime, HorizontalAlign, VerticalAlign } from 'jimp';
import fs from 'fs';
import path from 'path';

// 모델 캐시 경로 설정
env.cacheDir = path.join(process.cwd(), '.cache', 'models');
env.allowLocalModels = true;

// 타입 정의
type ImageFeatureExtractor = (images: string | string[]) => Promise<{ data: Float32Array }>;

interface DetectionResult {
  brandId: string;
  brandName: string;
  confidence: number;
  bbox: { x: number; y: number; width: number; height: number };
}

interface LogoEmbedding {
  brandId: string;
  embedding: number[];
  name: string;
}

class EmbeddingService {
  private extractor: ImageFeatureExtractor | null = null;
  private isLoading = false;
  private loadPromise: Promise<void> | null = null;

  // 임베딩 캐시 (메모리)
  private embeddingCache = new Map<string, number[]>();

  /**
   * CLIP 모델 초기화 (지연 로딩)
   */
  async initialize(): Promise<void> {
    if (this.extractor) return;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = this._loadModel();
    return this.loadPromise;
  }

  private async _loadModel(): Promise<void> {
    if (this.isLoading) return;
    this.isLoading = true;

    try {
      console.log('[Embedding] Loading CLIP model...');
      this.extractor = await pipeline(
        'image-feature-extraction',
        'Xenova/clip-vit-base-patch32'
      ) as unknown as ImageFeatureExtractor;
      console.log('[Embedding] CLIP model loaded successfully');
    } catch (error) {
      console.error('[Embedding] Failed to load CLIP model:', error);
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * 이미지 파일에서 임베딩 벡터 추출
   */
  async getImageEmbedding(imagePath: string): Promise<number[]> {
    await this.initialize();

    if (!this.extractor) {
      throw new Error('Embedding model not initialized');
    }

    // 캐시 확인
    if (this.embeddingCache.has(imagePath)) {
      return this.embeddingCache.get(imagePath)!;
    }

    try {
      let imageInput = imagePath;
      if (!imagePath.startsWith('http') && !imagePath.startsWith('data:')) {
        if (imagePath.startsWith('/uploads/')) {
          imageInput = path.join(process.cwd(), imagePath);
        }
      }

      const output = await this.extractor(imageInput);
      const embedding = Array.from(output.data);

      // 캐시 저장
      this.embeddingCache.set(imagePath, embedding);

      return embedding;
    } catch (error) {
      console.error('[Embedding] Failed to extract embedding:', error);
      throw error;
    }
  }

  /**
   * Buffer에서 임베딩 벡터 추출
   */
  async getEmbeddingFromBuffer(buffer: Buffer): Promise<number[]> {
    await this.initialize();

    if (!this.extractor) {
      throw new Error('Embedding model not initialized');
    }

    // 임시 파일에 저장 후 경로로 처리 (data URL 호환성 문제 우회)
    const tempDir = path.join(process.cwd(), 'uploads', 'temp');
    const tempPath = path.join(tempDir, `embed_${Date.now()}_${Math.random().toString(36).slice(2)}.png`);

    try {
      // 임시 디렉토리 생성
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // 버퍼를 파일로 저장
      fs.writeFileSync(tempPath, buffer);

      // 파일 경로로 임베딩 추출
      const output = await this.extractor(tempPath);
      const embedding = Array.from(output.data);

      // 임시 파일 삭제
      fs.unlinkSync(tempPath);

      return embedding;
    } catch (error) {
      // 임시 파일 정리
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
      console.error('[Embedding] Failed to extract embedding from buffer:', error);
      throw error;
    }
  }

  /**
   * 코사인 유사도 계산
   */
  cosineSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length || embedding1.length === 0) {
      return 0;
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    if (magnitude === 0) return 0;

    return dotProduct / magnitude;
  }

  /**
   * [최적화] 2단계 로고 검출
   * Stage 1: 저해상도 피라미드 스캔으로 후보 영역 탐색
   * Stage 2: 후보 영역만 정밀 CLIP 비교
   */
  async detectLogosInFrame(
    framePath: string,
    logoEmbeddings: LogoEmbedding[],
    options: {
      threshold?: number;
      maxCandidates?: number;  // 최대 후보 영역 수
      quickScan?: boolean;     // 빠른 스캔 모드
    } = {}
  ): Promise<DetectionResult[]> {
    const {
      threshold = 0.75,
      maxCandidates = 50,
      quickScan = true,
    } = options;

    // 로컬 파일 경로 처리
    let fullPath = framePath;
    if (framePath.startsWith('/uploads/')) {
      fullPath = path.join(process.cwd(), framePath);
    }

    // 파일 존재 확인
    if (!fs.existsSync(fullPath)) {
      console.error(`[Embedding] File not found: ${fullPath}`);
      return [];
    }

    const startTime = Date.now();

    try {
      // Stage 1: 후보 영역 탐색 (빠른 스캔)
      const candidates = quickScan
        ? await this.findCandidateRegionsFast(fullPath, maxCandidates)
        : await this.findCandidateRegionsGrid(fullPath);

      console.log(`[Embedding] Stage 1: Found ${candidates.length} candidate regions in ${Date.now() - startTime}ms`);

      if (candidates.length === 0) {
        return [];
      }

      // Stage 2: 후보 영역에서 CLIP 비교
      const detections = await this.compareCandidatesWithLogos(
        fullPath,
        candidates,
        logoEmbeddings,
        threshold
      );

      console.log(`[Embedding] Stage 2: Detected ${detections.length} logos in ${Date.now() - startTime}ms total`);

      return this.nonMaxSuppression(detections, 0.5);
    } catch (error) {
      console.error('[Embedding] Detection failed:', error);
      return [];
    }
  }

  /**
   * [Stage 1-A] 빠른 후보 영역 탐색 (그리드 + 밝기 기반)
   */
  private async findCandidateRegionsFast(
    imagePath: string,
    maxCandidates: number
  ): Promise<Array<{ x: number; y: number; width: number; height: number; score: number }>> {
    const candidates: Array<{ x: number; y: number; width: number; height: number; score: number }> = [];

    // 이미지 로드
    const image = await Jimp.read(imagePath);
    const width = image.width;
    const height = image.height;

    // 저해상도로 리사이즈 (처리 속도 향상)
    const scale = Math.min(640 / width, 480 / height, 1);
    const scaledWidth = Math.round(width * scale);
    const scaledHeight = Math.round(height * scale);

    const scaled = image.clone().resize({ w: scaledWidth, h: scaledHeight }).greyscale();

    // 셀 기반 밝기 변화 측정 (에지 대신)
    const cellSize = 32;
    const gridCols = Math.ceil(scaledWidth / cellSize);
    const gridRows = Math.ceil(scaledHeight / cellSize);

    const cellScores: Array<{ x: number; y: number; score: number }> = [];

    for (let gy = 0; gy < gridRows; gy++) {
      for (let gx = 0; gx < gridCols; gx++) {
        let totalVariance = 0;
        let pixelCount = 0;
        let sum = 0;
        const values: number[] = [];

        const startX = gx * cellSize;
        const startY = gy * cellSize;
        const endX = Math.min(startX + cellSize, scaledWidth);
        const endY = Math.min(startY + cellSize, scaledHeight);

        for (let py = startY; py < endY; py++) {
          for (let px = startX; px < endX; px++) {
            // jimp 1.x에서 픽셀 색상 가져오기
            const color = scaled.getPixelColor(px, py);
            // RGBA에서 R값만 사용 (greyscale이므로 R=G=B)
            const gray = (color >> 24) & 0xFF;
            values.push(gray);
            sum += gray;
            pixelCount++;
          }
        }

        // 분산 계산 (에지가 많은 영역은 분산이 높음)
        if (pixelCount > 0) {
          const mean = sum / pixelCount;
          for (const v of values) {
            totalVariance += (v - mean) * (v - mean);
          }
          totalVariance = Math.sqrt(totalVariance / pixelCount);
        }

        cellScores.push({
          x: Math.round(startX / scale),
          y: Math.round(startY / scale),
          score: totalVariance,
        });
      }
    }

    // 분산 상위 영역 선택 (에지가 많은 영역)
    cellScores.sort((a, b) => b.score - a.score);
    const topCells = cellScores.slice(0, Math.min(maxCandidates * 2, cellScores.length));

    // 다양한 크기의 윈도우 생성
    const windowSizes = [80, 120, 160];
    const cellSizeOriginal = Math.round(cellSize / scale);

    for (const cell of topCells) {
      for (const windowSize of windowSizes) {
        const cx = cell.x + cellSizeOriginal / 2;
        const cy = cell.y + cellSizeOriginal / 2;
        const x = Math.max(0, Math.round(cx - windowSize / 2));
        const y = Math.max(0, Math.round(cy - windowSize / 2));

        if (x + windowSize <= width && y + windowSize <= height) {
          candidates.push({
            x,
            y,
            width: windowSize,
            height: windowSize,
            score: cell.score,
          });
        }
      }
    }

    return this.deduplicateCandidates(candidates).slice(0, maxCandidates);
  }

  /**
   * [Stage 1-B] 그리드 기반 후보 탐색 (간단하지만 더 느림)
   */
  private async findCandidateRegionsGrid(
    imagePath: string
  ): Promise<Array<{ x: number; y: number; width: number; height: number; score: number }>> {
    const image = await Jimp.read(imagePath);
    const imgWidth = image.width;
    const imgHeight = image.height;

    const candidates: Array<{ x: number; y: number; width: number; height: number; score: number }> = [];
    const windowSizes = [100, 150];
    const stride = 0.5;

    for (const windowSize of windowSizes) {
      const stridePixels = Math.round(windowSize * stride);

      for (let y = 0; y <= imgHeight - windowSize; y += stridePixels) {
        for (let x = 0; x <= imgWidth - windowSize; x += stridePixels) {
          candidates.push({ x, y, width: windowSize, height: windowSize, score: 1 });
        }
      }
    }

    return candidates;
  }

  /**
   * 후보 영역 중복 제거
   */
  private deduplicateCandidates(
    candidates: Array<{ x: number; y: number; width: number; height: number; score: number }>
  ): typeof candidates {
    const kept: typeof candidates = [];

    for (const c of candidates) {
      let isDuplicate = false;
      for (const k of kept) {
        const iou = this.calculateIoU(c, k);
        if (iou > 0.5) {
          isDuplicate = true;
          break;
        }
      }
      if (!isDuplicate) {
        kept.push(c);
      }
    }

    return kept;
  }

  /**
   * [Stage 2] 후보 영역에서 CLIP 비교
   */
  private async compareCandidatesWithLogos(
    imagePath: string,
    candidates: Array<{ x: number; y: number; width: number; height: number }>,
    logoEmbeddings: LogoEmbedding[],
    threshold: number
  ): Promise<DetectionResult[]> {
    const detections: DetectionResult[] = [];
    const batchSize = 8; // 배치 크기 축소 (메모리 효율)

    for (let i = 0; i < candidates.length; i += batchSize) {
      const batch = candidates.slice(i, i + batchSize);
      const embeddings = await this.getRegionEmbeddings(imagePath, batch);

      for (let j = 0; j < embeddings.length; j++) {
        const regionEmbedding = embeddings[j];
        if (regionEmbedding.length === 0) continue;

        for (const logo of logoEmbeddings) {
          const similarity = this.cosineSimilarity(regionEmbedding, logo.embedding);

          if (similarity >= threshold) {
            detections.push({
              brandId: logo.brandId,
              brandName: logo.name,
              confidence: similarity,
              bbox: batch[j],
            });
          }
        }
      }
    }

    return detections;
  }

  /**
   * 영역 임베딩 추출 (배치)
   */
  async getRegionEmbeddings(
    imagePath: string,
    regions: Array<{ x: number; y: number; width: number; height: number }>
  ): Promise<number[][]> {
    const embeddings: number[][] = [];

    let fullPath = imagePath;
    if (imagePath.startsWith('/uploads/')) {
      fullPath = path.join(process.cwd(), imagePath);
    }

    const image = await Jimp.read(fullPath);

    for (const region of regions) {
      try {
        const x = Math.max(0, Math.round(region.x));
        const y = Math.max(0, Math.round(region.y));
        const w = Math.max(1, Math.round(region.width));
        const h = Math.max(1, Math.round(region.height));

        // 영역 자르기 + 224x224 리사이즈
        const cropped = image.clone()
          .crop({ x, y, w, h })
          .contain({ w: 224, h: 224, align: HorizontalAlign.CENTER | VerticalAlign.MIDDLE });

        // 흰색 배경 이미지 생성 후 합성
        const background = new Jimp({ width: 224, height: 224, color: 0xFFFFFFFF });
        background.composite(cropped, 0, 0);

        const croppedBuffer = await background.getBuffer(JimpMime.png);

        const embedding = await this.getEmbeddingFromBuffer(croppedBuffer);
        embeddings.push(embedding);
      } catch (error) {
        console.error('[Embedding] Failed to extract region:', error);
        embeddings.push([]);
      }
    }

    return embeddings;
  }

  /**
   * Non-Maximum Suppression
   */
  private nonMaxSuppression(
    detections: DetectionResult[],
    iouThreshold: number
  ): DetectionResult[] {
    if (detections.length === 0) return [];

    const sorted = [...detections].sort((a, b) => b.confidence - a.confidence);
    const kept: DetectionResult[] = [];

    while (sorted.length > 0) {
      const best = sorted.shift()!;
      kept.push(best);

      for (let i = sorted.length - 1; i >= 0; i--) {
        if (this.calculateIoU(best.bbox, sorted[i].bbox) > iouThreshold) {
          sorted.splice(i, 1);
        }
      }
    }

    return kept;
  }

  /**
   * IoU 계산
   */
  private calculateIoU(
    box1: { x: number; y: number; width: number; height: number },
    box2: { x: number; y: number; width: number; height: number }
  ): number {
    const x1 = Math.max(box1.x, box2.x);
    const y1 = Math.max(box1.y, box2.y);
    const x2 = Math.min(box1.x + box1.width, box2.x + box2.width);
    const y2 = Math.min(box1.y + box1.height, box2.y + box2.height);

    const intersectionArea = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
    const box1Area = box1.width * box1.height;
    const box2Area = box2.width * box2.height;
    const unionArea = box1Area + box2Area - intersectionArea;

    return unionArea > 0 ? intersectionArea / unionArea : 0;
  }

  /**
   * 캐시 초기화
   */
  clearCache(): void {
    this.embeddingCache.clear();
  }
}

export const embeddingService = new EmbeddingService();
