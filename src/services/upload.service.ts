import multer from 'multer';
import path from 'path';
import { BadRequestError } from '../utils/errors';

// File type configurations
const FILE_CONFIGS = {
  image: {
    mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    maxSize: 10 * 1024 * 1024, // 10MB
    extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  },
  document: {
    mimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
    maxSize: 20 * 1024 * 1024, // 20MB
    extensions: ['.pdf', '.jpg', '.jpeg', '.png'],
  },
  any: {
    mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'],
    maxSize: 20 * 1024 * 1024,
    extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf'],
  },
};

// Memory storage for Cloudinary upload
const memoryStorage = multer.memoryStorage();

// File filter
const createFileFilter = (fileType: keyof typeof FILE_CONFIGS) => {
  return (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const config = FILE_CONFIGS[fileType];
    const ext = path.extname(file.originalname).toLowerCase();

    if (!config.mimeTypes.includes(file.mimetype)) {
      return cb(new BadRequestError(`허용되지 않는 파일 형식입니다. (허용: ${config.mimeTypes.join(', ')})`));
    }

    if (!config.extensions.includes(ext)) {
      return cb(new BadRequestError(`허용되지 않는 파일 확장자입니다. (허용: ${config.extensions.join(', ')})`));
    }

    cb(null, true);
  };
};

// Create multer instances for different upload types (using memory storage for Cloudinary)
export const uploadAsset = multer({
  storage: memoryStorage,
  fileFilter: createFileFilter('image'),
  limits: { fileSize: FILE_CONFIGS.image.maxSize },
});

export const uploadKyc = multer({
  storage: memoryStorage,
  fileFilter: createFileFilter('document'),
  limits: { fileSize: FILE_CONFIGS.document.maxSize },
});

export const uploadVerification = multer({
  storage: memoryStorage,
  fileFilter: createFileFilter('image'),
  limits: { fileSize: FILE_CONFIGS.image.maxSize },
});

export const uploadProfile = multer({
  storage: memoryStorage,
  fileFilter: createFileFilter('image'),
  limits: { fileSize: FILE_CONFIGS.image.maxSize },
});

// Upload service class (kept for backward compatibility)
class UploadService {
  // Validate uploaded file
  validateFile(file: Express.Multer.File | undefined, required: boolean = true): Express.Multer.File {
    if (!file) {
      if (required) {
        throw new BadRequestError('파일이 필요합니다.');
      }
      throw new BadRequestError('파일이 제공되지 않았습니다.');
    }
    return file;
  }
}

export const uploadService = new UploadService();
