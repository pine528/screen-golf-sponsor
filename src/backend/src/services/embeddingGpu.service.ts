/**
 * GPU 서버 기반 CLIP 임베딩 서비스
 * - 원격 GPU 서버(FastAPI)와 HTTP 통신
 * - CPU 버전 대비 30~50배 빠름
 */
import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

interface DetectionResult {
  brandId: string;
  brandName: string;
  confidence: number;
  bbox: { x: number; y: number; width: number; height: number };
}

interface LogoEmbedding {
  brandId: string;
  name: string;
  embedding: number[];
}

interface GpuServerConfig {
  url: string;
  timeout: number;
  retries: number;
}

class EmbeddingGpuService {
  private client: AxiosInstance;
  private config: GpuServerConfig;
  private isAvailable: boolean = false;

  constructor() {
    this.config = {
      url: process.env.GPU_SERVER_URL || 'http://localhost:8001',
      timeout: parseInt(process.env.GPU_SERVER_TIMEOUT || '60000'),
      retries: parseInt(process.env.GPU_SERVER_RETRIES || '3'),
    };

    this.client = axios.create({
      baseURL: this.config.url,
      timeout: this.config.timeout,
    });

    // 서버 상태 확인
    this.checkHealth();
  }

  /**
   * GPU 서버 상태 확인
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await this.client.get('/health', { timeout: 5000 });
      this.isAvailable = response.data.status === 'healthy' && response.data.model_loaded;
      console.log(`[EmbeddingGPU] Server status: ${this.isAvailable ? 'available' : 'unavailable'}`);
      console.log(`[EmbeddingGPU] Device: ${response.data.device}`);
      return this.isAvailable;
    } catch (error) {
      this.isAvailable = false;
      console.warn(`[EmbeddingGPU] Server not available: ${this.config.url}`);
      return false;
    }
  }

  /**
   * GPU 서버 사용 가능 여부
   */
  isServerAvailable(): boolean {
    return this.isAvailable;
  }

  /**
   * 이미지 파일에서 임베딩 벡터 추출
   */
  async getImageEmbedding(imagePath: string): Promise<number[]> {
    // 파일 경로 처리
    let fullPath = imagePath;
    if (imagePath.startsWith('/uploads/')) {
      fullPath = path.join(process.cwd(), imagePath);
    }

    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${fullPath}`);
    }

    const formData = new FormData();
    formData.append('file', fs.createReadStream(fullPath));

    let lastError: Error | null = null;

    // 재시도 로직
    for (let attempt = 1; attempt <= this.config.retries; attempt++) {
      try {
        const response = await this.client.post('/embed/image', formData, {
          headers: formData.getHeaders(),
        });

        console.log(`[EmbeddingGPU] Embedding extracted in ${response.data.elapsed_ms}ms`);
        return response.data.embedding;
      } catch (error: any) {
        lastError = error;
        console.warn(`[EmbeddingGPU] Attempt ${attempt}/${this.config.retries} failed: ${error.message}`);

        if (attempt < this.config.retries) {
          await this.delay(1000 * attempt); // 점진적 대기
        }
      }
    }

    throw lastError || new Error('Failed to get embedding');
  }

  /**
   * Buffer에서 임베딩 벡터 추출
   */
  async getEmbeddingFromBuffer(buffer: Buffer, filename: string = 'image.png'): Promise<number[]> {
    const formData = new FormData();
    formData.append('file', buffer, { filename });

    const response = await this.client.post('/embed/image', formData, {
      headers: formData.getHeaders(),
    });

    return response.data.embedding;
  }

  /**
   * 프레임에서 로고 검출
   */
  async detectLogosInFrame(
    framePath: string,
    logoEmbeddings: LogoEmbedding[],
    options: {
      threshold?: number;
      windowSizes?: number[];
      stride?: number;
      maxDetections?: number;
    } = {}
  ): Promise<DetectionResult[]> {
    const {
      threshold = 0.75,
      windowSizes = [140],       // 1개로 줄여서 속도 2배 향상
      stride = 0.7,              // 0.6→0.7 (처리 영역 추가 감소)
      maxDetections = 30,        // 50→30 (NMS 부하 감소)
    } = options;

    // 파일 경로 처리
    let fullPath = framePath;
    if (framePath.startsWith('/uploads/')) {
      fullPath = path.join(process.cwd(), framePath);
    }

    if (!fs.existsSync(fullPath)) {
      console.error(`[EmbeddingGPU] File not found: ${fullPath}`);
      return [];
    }

    const formData = new FormData();
    formData.append('file', fs.createReadStream(fullPath));
    formData.append('logo_embeddings', JSON.stringify(logoEmbeddings));
    formData.append('threshold', threshold.toString());
    formData.append('window_sizes', windowSizes.join(','));
    formData.append('stride', stride.toString());
    formData.append('max_detections', maxDetections.toString());

    const startTime = Date.now();
    try {
      const response = await this.client.post('/detect/logos', formData, {
        headers: formData.getHeaders(),
        timeout: this.config.timeout * 2, // 검출은 시간이 더 걸림
      });

      const elapsedMs = response.data.elapsed_ms ?? (Date.now() - startTime);
      console.log(`[EmbeddingGPU] Detection completed: ${response.data.detections.length} logos in ${elapsedMs}ms`);
      return response.data.detections;
    } catch (error: any) {
      console.error(`[EmbeddingGPU] Detection failed: ${error.message}`);
      return [];
    }
  }

  /**
   * 여러 프레임 배치 검출
   */
  async detectLogosInBatch(
    framePaths: string[],
    logoEmbeddings: LogoEmbedding[],
    options: { threshold?: number } = {}
  ): Promise<Map<string, DetectionResult[]>> {
    const { threshold = 0.75 } = options;

    const formData = new FormData();

    // 파일들 추가
    for (const framePath of framePaths) {
      let fullPath = framePath;
      if (framePath.startsWith('/uploads/')) {
        fullPath = path.join(process.cwd(), framePath);
      }

      if (fs.existsSync(fullPath)) {
        formData.append('files', fs.createReadStream(fullPath));
      }
    }

    formData.append('logo_embeddings', JSON.stringify(logoEmbeddings));
    formData.append('threshold', threshold.toString());

    try {
      const response = await this.client.post('/detect/batch', formData, {
        headers: formData.getHeaders(),
        timeout: this.config.timeout * framePaths.length,
      });

      const resultMap = new Map<string, DetectionResult[]>();
      for (const result of response.data.results) {
        resultMap.set(result.filename, result.detections || []);
      }

      return resultMap;
    } catch (error: any) {
      console.error(`[EmbeddingGPU] Batch detection failed: ${error.message}`);
      return new Map();
    }
  }

  /**
   * 코사인 유사도 계산 (로컬)
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
    return magnitude > 0 ? dotProduct / magnitude : 0;
  }

  /**
   * 딜레이 유틸리티
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const embeddingGpuService = new EmbeddingGpuService();
