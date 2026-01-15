import { Router } from 'express';
import { athleteController } from '../controllers/athlete.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

/**
 * @route GET /athletes
 * @desc List all athletes
 */
router.get('/', authenticate, athleteController.list);

/**
 * @route GET /athletes/me
 * @desc Get current athlete profile
 */
router.get('/me', authenticate, authorize('ATHLETE'), athleteController.getMe);

/**
 * @route GET /athletes/me/stats
 * @desc Get athlete statistics
 */
router.get('/me/stats', authenticate, authorize('ATHLETE'), athleteController.getStats);

/**
 * @route GET /athletes/me/slots
 * @desc Get athlete's available slots
 */
router.get('/me/slots', authenticate, authorize('ATHLETE'), athleteController.getAvailableSlots);

/**
 * @route PATCH /athletes/me
 * @desc Update current athlete profile
 */
router.patch('/me', authenticate, authorize('ATHLETE'), athleteController.update);

/**
 * @route PATCH /athletes/me/bank
 * @desc Update bank information
 */
router.patch('/me/bank', authenticate, authorize('ATHLETE'), athleteController.updateBankInfo);

/**
 * @route PATCH /athletes/me/bank-account
 * @desc Update bank account (simplified)
 */
router.patch('/me/bank-account', authenticate, authorize('ATHLETE'), athleteController.updateBankAccount);

/**
 * @route PATCH /athletes/me/slots
 * @desc Update slot availability (blocked categories)
 */
router.patch('/me/slots', authenticate, authorize('ATHLETE'), athleteController.updateSlotAvailability);

/**
 * @route POST /athletes/me/kyc
 * @desc Submit KYC documents
 */
router.post('/me/kyc', authenticate, authorize('ATHLETE'), athleteController.submitKyc);

/**
 * @route GET /athletes/:id
 * @desc Get athlete by ID
 */
router.get('/:id', authenticate, athleteController.getById);

export default router;
