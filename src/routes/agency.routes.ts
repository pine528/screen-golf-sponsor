import { Router } from 'express';
import { agencyController } from '../controllers/agency.controller';
import { agencyAthleteRequestController } from '../controllers/agencyAthleteRequest.controller';
import { authenticate, authorize, requireKycApproved } from '../middleware/auth';

const router = Router();

// 모든 에이전시 라우트는 인증 필수
router.use(authenticate);
router.use(authorize('AGENCY'));

// 에이전시 프로필
router.get('/me', agencyController.getMe);
router.patch('/me', agencyController.updateMe);
router.post('/me/kyc', agencyController.submitKyc);
router.get('/stats', agencyController.getStats);

// 선수 연결 요청 관련 (신규 기능)
router.get('/athletes/search', requireKycApproved, agencyAthleteRequestController.searchAthletes);
router.post('/athletes/request', requireKycApproved, agencyAthleteRequestController.createRequest);
router.get('/requests/sent', agencyAthleteRequestController.getSentRequests);
router.delete('/requests/:requestId', agencyAthleteRequestController.cancelRequest);

// 선수 관리 (KYC 승인 필수)
router.post('/athletes', requireKycApproved, agencyController.registerAthlete);
router.get('/athletes', agencyController.getAthletes);
router.get('/athletes/performance', agencyController.getAllAthletesPerformance); // 모든 선수 성과 (리스트 위에)
router.delete('/athletes/:athleteId', agencyController.unassignAthlete);

// 선수 상세 정보 및 프로필 관리
router.get('/athletes/:athleteId/detail', agencyController.getAthleteDetail);
router.patch('/athletes/:athleteId/profile', requireKycApproved, agencyController.updateAthleteProfile);
router.post('/athletes/:athleteId/kyc', requireKycApproved, agencyController.submitAthleteKyc);
router.patch('/athletes/:athleteId/bank-account', requireKycApproved, agencyController.updateAthleteBankAccount);

// 선수 슬롯 관리
router.get('/athletes/:athleteId/slots', agencyController.getAthleteSlots);
router.patch(
  '/athletes/:athleteId/slots/:slotId/sale-mode',
  requireKycApproved,
  agencyController.updateAthleteSlotSaleMode
);

// 선수 계약 관리
router.get('/athletes/:athleteId/contracts', agencyController.getAthleteContracts);
router.post(
  '/athletes/:athleteId/contracts/:contractId/sign',
  requireKycApproved,
  agencyController.signContractForAthlete
);

// 선수 정산/출금 조회
router.get('/athletes/:athleteId/settlements', agencyController.getAthleteSettlements);
router.get('/athletes/:athleteId/withdrawals', agencyController.getAthleteWithdrawals);

// 선수 성과 통계
router.get('/athletes/:athleteId/performance', agencyController.getAthletePerformance);

// 서명 대기 계약 목록
router.get('/pending-signatures', agencyController.getPendingSignatures);

export default router;
