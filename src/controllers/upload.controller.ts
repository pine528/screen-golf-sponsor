import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { cloudinaryService } from '../services/cloudinary.service';
import { sendSuccess } from '../utils/response';
import { BadRequestError } from '../utils/errors';

export class UploadController {
  // Upload single asset file
  async uploadAssetFile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw new BadRequestError('파일이 필요합니다.');
      }

      const result = await cloudinaryService.uploadFile(req.file, 'assets');

      sendSuccess(res, {
        fileUrl: result.url,
        fileName: result.fileName,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
      }, 201);
    } catch (error) {
      next(error);
    }
  }

  // Upload multiple asset files
  async uploadAssetFiles(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        throw new BadRequestError('파일이 필요합니다.');
      }

      const results = await cloudinaryService.uploadFiles(files, 'assets');

      sendSuccess(res, {
        files: results.map((result, index) => ({
          fileUrl: result.url,
          fileName: result.fileName,
          fileSize: files[index].size,
          mimeType: files[index].mimetype,
        })),
      }, 201);
    } catch (error) {
      next(error);
    }
  }

  // Upload KYC documents
  async uploadKycDocument(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw new BadRequestError('파일이 필요합니다.');
      }

      const result = await cloudinaryService.uploadFile(req.file, 'kyc');

      sendSuccess(res, {
        fileUrl: result.url,
        fileName: result.fileName,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        documentType: req.body.documentType || 'general',
      }, 201);
    } catch (error) {
      next(error);
    }
  }

  // Upload multiple KYC documents
  async uploadKycDocuments(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        throw new BadRequestError('파일이 필요합니다.');
      }

      const results = await cloudinaryService.uploadFiles(files, 'kyc');

      sendSuccess(res, {
        files: results.map((result, index) => ({
          fileUrl: result.url,
          fileName: result.fileName,
          fileSize: files[index].size,
          mimeType: files[index].mimetype,
        })),
      }, 201);
    } catch (error) {
      next(error);
    }
  }

  // Upload verification photos
  async uploadVerificationPhotos(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        throw new BadRequestError('파일이 필요합니다.');
      }

      const results = await cloudinaryService.uploadFiles(files, 'verification');

      sendSuccess(res, {
        files: results.map((result, index) => ({
          fileUrl: result.url,
          fileName: result.fileName,
          fileSize: files[index].size,
          mimeType: files[index].mimetype,
        })),
      }, 201);
    } catch (error) {
      next(error);
    }
  }

  // Upload profile image
  async uploadProfileImage(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw new BadRequestError('파일이 필요합니다.');
      }

      const result = await cloudinaryService.uploadFile(req.file, 'profile');

      sendSuccess(res, {
        fileUrl: result.url,
        fileName: result.fileName,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
      }, 201);
    } catch (error) {
      next(error);
    }
  }
}

export const uploadController = new UploadController();
