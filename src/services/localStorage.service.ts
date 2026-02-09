import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export type UploadFolder = 'kyc' | 'assets' | 'verification' | 'profile' | 'evidence' | 'vod';

const UPLOAD_BASE_DIR = path.join(process.cwd(), 'uploads');

// 서버 Base URL (동적으로 결정)
const getBaseUrl = () => process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`;

class LocalStorageService {
  constructor() {
    // Create upload directories if they don't exist
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    const folders: UploadFolder[] = ['kyc', 'assets', 'verification', 'profile', 'evidence', 'vod'];

    if (!fs.existsSync(UPLOAD_BASE_DIR)) {
      fs.mkdirSync(UPLOAD_BASE_DIR, { recursive: true });
    }

    folders.forEach(folder => {
      const folderPath = path.join(UPLOAD_BASE_DIR, folder);
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }
    });
  }

  /**
   * Buffer를 로컬에 저장 (Cloudinary uploadBuffer 호환)
   */
  /**
   * Buffer를 로컬에 저장 (Cloudinary uploadBuffer 호환)
   * @param buffer - 파일 버퍼
   * @param folder - 저장 폴더
   * @param options - 옵션 (filename, resource_type)
   */
  async uploadBuffer(
    buffer: Buffer,
    folder: UploadFolder,
    options?: {
      filename?: string;
      resource_type?: 'image' | 'raw' | 'auto';
    }
  ): Promise<{
    public_id: string;
    secure_url: string;
    url: string;
    format: string;
    bytes: number;
  }> {
    // 파일명 결정
    let fileName: string;

    if (options?.filename) {
      // 파일명에 확장자가 있으면 그대로 사용
      const hasExtension = /\.[^.]+$/.test(options.filename);
      if (hasExtension) {
        fileName = options.filename;
      } else {
        // 확장자가 없으면 resource_type에 따라 추가
        const ext = options?.resource_type === 'image' ? '.jpg' : '.bin';
        fileName = `${options.filename}${ext}`;
      }
    } else {
      // 파일명이 없으면 UUID 생성
      const ext = options?.resource_type === 'image' ? '.jpg' : '.bin';
      fileName = `${uuidv4()}${ext}`;
    }
    const filePath = path.join(UPLOAD_BASE_DIR, folder, fileName);

    // 디렉토리 확인
    const folderPath = path.join(UPLOAD_BASE_DIR, folder);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    // 파일 저장
    fs.writeFileSync(filePath, buffer);

    const publicId = `${folder}/${fileName}`;
    const url = `${getBaseUrl()}/uploads/${folder}/${fileName}`;

    // 확장자 추출 (format 반환용)
    const extMatch = fileName.match(/\.([^.]+)$/);
    const format = extMatch ? extMatch[1] : 'bin';

    return {
      public_id: publicId,
      secure_url: url,
      url,
      format,
      bytes: buffer.length,
    };
  }

  /**
   * Multer 파일을 로컬에 저장
   */
  async uploadFile(
    file: Express.Multer.File,
    folder: UploadFolder
  ): Promise<{ url: string; publicId: string; fileName: string }> {
    const ext = path.extname(file.originalname);
    const uniqueId = uuidv4();
    const fileName = `${uniqueId}${ext}`;
    const filePath = path.join(UPLOAD_BASE_DIR, folder, fileName);

    // Save file
    fs.writeFileSync(filePath, file.buffer);

    // Return relative URL for proper proxy handling in development
    // In production, a CDN or reverse proxy will serve from the same origin
    const url = `/uploads/${folder}/${fileName}`;

    return {
      url,
      publicId: `${folder}/${fileName}`,
      fileName: file.originalname,
    };
  }

  /**
   * 여러 파일 업로드
   */
  async uploadFiles(
    files: Express.Multer.File[],
    folder: UploadFolder
  ): Promise<{ url: string; publicId: string; fileName: string }[]> {
    const uploadPromises = files.map(file => this.uploadFile(file, folder));
    return Promise.all(uploadPromises);
  }

  /**
   * 파일 삭제
   */
  async deleteFile(publicId: string): Promise<boolean> {
    try {
      const filePath = path.join(UPLOAD_BASE_DIR, publicId);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return true;
    } catch (error) {
      console.error('Local storage delete error:', error);
      return false;
    }
  }
}

export const localStorageService = new LocalStorageService();
