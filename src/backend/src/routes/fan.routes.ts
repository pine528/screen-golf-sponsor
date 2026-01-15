import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { z } from 'zod';
import * as fanController from '../controllers/fan.controller';

const router = Router();

// All fan routes require FAN role authentication
router.use(authenticate);
router.use(authorize('FAN'));

// ============================================
// Favorites
// ============================================

// GET /api/fan/favorites - Get all favorites (athletes and brands)
router.get('/favorites', fanController.getFavorites);

// POST /api/fan/favorites/athletes/:athleteId - Add athlete to favorites
router.post('/favorites/athletes/:athleteId', fanController.addFavoriteAthlete);

// DELETE /api/fan/favorites/athletes/:athleteId - Remove athlete from favorites
router.delete('/favorites/athletes/:athleteId', fanController.removeFavoriteAthlete);

// POST /api/fan/favorites/brands/:brandId - Add brand to favorites
router.post('/favorites/brands/:brandId', fanController.addFavoriteBrand);

// DELETE /api/fan/favorites/brands/:brandId - Remove brand from favorites
router.delete('/favorites/brands/:brandId', fanController.removeFavoriteBrand);

// ============================================
// Brand Registration Request
// ============================================

const brandRegistrationSchema = z.object({
  brandName: z.string().min(2, '브랜드명은 최소 2자 이상이어야 합니다').max(100),
  contactEmail: z.string().email('유효한 이메일을 입력하세요'),
  contactPhone: z.string().optional(),
  website: z.string().url('유효한 URL을 입력하세요').optional().or(z.literal('')),
  note: z.string().max(1000).optional(),
});

// POST /api/fan/brand-registration - Submit brand registration request
router.post(
  '/brand-registration',
  validate(brandRegistrationSchema),
  fanController.submitBrandRegistration
);

// GET /api/fan/brand-registration - Get my brand registration requests
router.get('/brand-registration', fanController.getMyBrandRegistrations);

export default router;
