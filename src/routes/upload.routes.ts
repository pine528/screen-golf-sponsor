import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { uploadController } from '../controllers/upload.controller';
import { uploadAsset, uploadKyc, uploadVerification, uploadProfile } from '../services/upload.service';

const router = Router();

// All upload routes require authentication
router.use(authenticate);

// Asset uploads (for creative assets)
router.post(
  '/asset',
  uploadAsset.single('file'),
  uploadController.uploadAssetFile.bind(uploadController)
);

router.post(
  '/assets',
  uploadAsset.array('files', 10),
  uploadController.uploadAssetFiles.bind(uploadController)
);

// KYC document uploads
router.post(
  '/kyc',
  uploadKyc.single('file'),
  uploadController.uploadKycDocument.bind(uploadController)
);

router.post(
  '/kyc/documents',
  uploadKyc.array('files', 5),
  uploadController.uploadKycDocuments.bind(uploadController)
);

// Verification photo uploads
router.post(
  '/verification',
  uploadVerification.array('files', 5),
  uploadController.uploadVerificationPhotos.bind(uploadController)
);

// Profile image upload
router.post(
  '/profile',
  uploadProfile.single('file'),
  uploadController.uploadProfileImage.bind(uploadController)
);

export default router;
