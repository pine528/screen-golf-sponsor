import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

// Cloudinary 설정
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export type UploadFolder = 'kyc' | 'assets' | 'verification' | 'profile';

interface CloudinaryUploadResult {
  public_id: string;
  secure_url: string;
  url: string;
  format: string;
  bytes: number;
  width?: number;
  height?: number;
}

class CloudinaryService {
  /**
   * Buffer를 Cloudinary에 업로드
   */
  async uploadBuffer(
    buffer: Buffer,
    folder: UploadFolder,
    options?: {
      filename?: string;
      resource_type?: 'image' | 'raw' | 'auto';
    }
  ): Promise<CloudinaryUploadResult> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `screen-golf/${folder}`,
          resource_type: options?.resource_type || 'auto',
          public_id: options?.filename,
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else if (result) {
            resolve(result as CloudinaryUploadResult);
          } else {
            reject(new Error('Upload failed'));
          }
        }
      );

      const readableStream = new Readable();
      readableStream.push(buffer);
      readableStream.push(null);
      readableStream.pipe(uploadStream);
    });
  }

  /**
   * Multer 파일을 Cloudinary에 업로드
   */
  async uploadFile(
    file: Express.Multer.File,
    folder: UploadFolder
  ): Promise<{ url: string; publicId: string; fileName: string }> {
    const result = await this.uploadBuffer(file.buffer, folder, {
      resource_type: file.mimetype.startsWith('image/') ? 'image' : 'raw',
    });

    return {
      url: result.secure_url,
      publicId: result.public_id,
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
      await cloudinary.uploader.destroy(publicId);
      return true;
    } catch (error) {
      console.error('Cloudinary delete error:', error);
      return false;
    }
  }

  /**
   * Cloudinary 설정 여부 확인
   */
  isConfigured(): boolean {
    return !!(
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
    );
  }
}

export const cloudinaryService = new CloudinaryService();
