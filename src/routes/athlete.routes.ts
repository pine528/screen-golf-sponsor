import { Router } from 'express';
import { athleteController } from '../controllers/athlete.controller';
import { agencyAthleteRequestController } from '../controllers/agencyAthleteRequest.controller';
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
 * ★ Phase 9-3: Athlete pending signatures API
 */

/**
 * @route GET /athletes/me/pending-signatures
 * @desc Get athlete's contracts pending signature
 */
router.get('/me/pending-signatures', authenticate, authorize('ATHLETE'), athleteController.getPendingSignatures);

/**
 * ★ 에이전시 연결 요청 관리 (선수용)
 */

/**
 * @route GET /athletes/agency-requests
 * @desc Get agency connection requests received by athlete
 */
router.get('/agency-requests', authenticate, authorize('ATHLETE'), agencyAthleteRequestController.getReceivedRequests);

/**
 * @route POST /athletes/agency-requests/:requestId/approve
 * @desc Approve an agency connection request
 */
router.post('/agency-requests/:requestId/approve', authenticate, authorize('ATHLETE'), agencyAthleteRequestController.approveRequest);

/**
 * @route POST /athletes/agency-requests/:requestId/reject
 * @desc Reject an agency connection request
 */
router.post('/agency-requests/:requestId/reject', authenticate, authorize('ATHLETE'), agencyAthleteRequestController.rejectRequest);

/**
 * @route GET /athletes/:id
 * @desc Get athlete by ID
 */
router.get('/:id', authenticate, athleteController.getById);

export default router;
