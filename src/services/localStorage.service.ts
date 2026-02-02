import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export type UploadFolder = 'kyc' | 'assets' | 'verification' | 'profile';

const UPLOAD_BASE_DIR = path.join(process.cwd(), 'uploads');

class LocalStorageService {
  constructor() {
    // Create upload directories if they don't exist
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    const folders: UploadFolder[] = ['kyc', 'assets', 'verification', 'profile'];

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

    // Return URL that can be accessed via static serving
    const baseUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`;
    const url = `${baseUrl}/uploads/${folder}/${fileName}`;

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
