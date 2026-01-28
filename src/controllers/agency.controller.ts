import { Response, NextFunction } from 'express';
import { agencyService } from '../services/agency.service';
import { AuthRequest } from '../types';
import { sendSuccess } from '../utils/response';
import { BadRequestError, ForbiddenError } from '../utils/errors';

export class AgencyController {
  /**
   * GET /agencies/me - 내 에이전시 프로필
   */
  async getMe(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id) {
        throw new ForbiddenError('Not authenticated');
      }

      const agency = await agencyService.findByUserId(req.user.id);
      sendSuccess(res, agency);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /agencies/me - 내 에이전시 프로필 수정
   */
  async updateMe(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id || !req.user?.agencyId) {
        throw new ForbiddenError('Not authenticated as agency');
      }

      const { name, bizNo, contactEmail, contactPhone, contactName, website, description } = req.body;

      const agency = await agencyService.update(req.user.agencyId, req.user.id, {
        name,
        bizNo,
        contactEmail,
        contactPhone,
        contactName,
        website,
        description,
      });

      sendSuccess(res, agency);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /agencies/me/kyc - KYC 제출
   */
  async submitKyc(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id) {
        throw new ForbiddenError('Not authenticated');
      }

      const { documents } = req.body;

      if (!documents || !Array.isArray(documents) || documents.length === 0) {
        throw new BadRequestError('Documents are required');
      }

      const agency = await agencyService.submitKyc(req.user.id, documents);
      sendSuccess(res, agency);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /agencies/stats - 에이전시 통계
   */
  async getStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id || !req.user?.agencyId) {
        throw new ForbiddenError('Not authenticated as agency');
      }

      const stats = await agencyService.getStats(req.user.agencyId);
      sendSuccess(res, stats);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /agencies/athletes - 선수 등록
   */
  async registerAthlete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id || !req.user?.agencyId) {
        throw new ForbiddenError('Not authenticated as agency');
      }

      const { email, password, name, tour, realName, bio, profileImageUrl } = req.body;

      if (!email || !password || !name || !tour) {
        throw new BadRequestError('Email, password, name, and tour are required');
      }

      if (password.length < 8) {
        throw new BadRequestError('Password must be at least 8 characters');
      }

      const athlete = await agencyService.registerAthlete(req.user.agencyId, req.user.id, {
        email,
        password,
        name,
        tour,
        realName,
        bio,
        profileImageUrl,
      });

      sendSuccess(res, athlete, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /agencies/athletes - 소속 선수 목록
   */
  async getAthletes(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id || !req.user?.agencyId) {
        throw new ForbiddenError('Not authenticated as agency');
      }

      const athletes = await agencyService.getAthletes(req.user.agencyId, req.user.id);
      sendSuccess(res, athletes);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /agencies/athletes/:athleteId - 선수 해제
   */
  async unassignAthlete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id || !req.user?.agencyId) {
        throw new ForbiddenError('Not authenticated as agency');
      }

      const { athleteId } = req.params;

      const athlete = await agencyService.unassignAthlete(
        req.user.agencyId,
        athleteId,
        req.user.id
      );

      sendSuccess(res, athlete);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /agencies/athletes/:athleteId/slots - 선수 슬롯 조회
   */
  async getAthleteSlots(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id || !req.user?.agencyId) {
        throw new ForbiddenError('Not authenticated as agency');
      }

      const { athleteId } = req.params;

      const slots = await agencyService.getAthleteSlots(
        req.user.agencyId,
        athleteId,
        req.user.id
      );

      sendSuccess(res, slots);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /agencies/athletes/:athleteId/slots/:slotId/sale-mode - 슬롯 판매모드 설정
   */
  async updateAthleteSlotSaleMode(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id) {
        throw new ForbiddenError('Not authenticated');
      }

      const { athleteId, slotId } = req.params;
      const { enableAuction, enableDirectBuy, directBuyPrice, auctionMinBid, auctionEndAt } = req.body;

      const slot = await agencyService.updateAthleteSlotSaleMode(
        req.user.id,
        athleteId,
        slotId,
        {
          enableAuction,
          enableDirectBuy,
          directBuyPrice,
          auctionMinBid,
          auctionEndAt: auctionEndAt ? new Date(auctionEndAt) : undefined,
        }
      );

      sendSuccess(res, slot);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /agencies/athletes/:athleteId/contracts/:contractId/sign - 선수 대신 계약 서명
   */
  async signContractForAthlete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id) {
        throw new ForbiddenError('Not authenticated');
      }

      const { athleteId, contractId } = req.params;

      const contract = await agencyService.signContractForAthlete(
        req.user.id,
        athleteId,
        contractId
      );

      sendSuccess(res, contract);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /agencies/pending-signatures - 서명 대기 계약 목록
   */
  async getPendingSignatures(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id || !req.user?.agencyId) {
        throw new ForbiddenError('Not authenticated as agency');
      }

      const contracts = await agencyService.getPendingSignatures(
        req.user.agencyId,
        req.user.id
      );

      sendSuccess(res, contracts);
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // 선수 대리 기능 (에이전시가 선수 대신 수행)
  // ============================================

  /**
   * GET /agencies/athletes/:athleteId/detail - 선수 상세 정보 조회
   */
  async getAthleteDetail(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id) {
        throw new ForbiddenError('Not authenticated');
      }

      const { athleteId } = req.params;
      const athlete = await agencyService.getAthleteDetail(req.user.id, athleteId);
      sendSuccess(res, athlete);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /agencies/athletes/:athleteId/profile - 선수 프로필 수정
   */
  async updateAthleteProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id) {
        throw new ForbiddenError('Not authenticated');
      }

      const { athleteId } = req.params;
      const { name, realName, bio, profileImageUrl, socialLinks, blockedCategories } = req.body;

      const athlete = await agencyService.updateAthleteProfile(req.user.id, athleteId, {
        name,
        realName,
        bio,
        profileImageUrl,
        socialLinks,
        blockedCategories,
      });

      sendSuccess(res, athlete);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /agencies/athletes/:athleteId/kyc - 선수 KYC 대신 제출
   */
  async submitAthleteKyc(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id) {
        throw new ForbiddenError('Not authenticated');
      }

      const { athleteId } = req.params;
      const { documents } = req.body;

      if (!documents || !Array.isArray(documents) || documents.length === 0) {
        throw new BadRequestError('Documents are required');
      }

      const athlete = await agencyService.submitAthleteKyc(req.user.id, athleteId, documents);
      sendSuccess(res, athlete);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /agencies/athletes/:athleteId/bank-account - 선수 은행 계좌 업데이트
   */
  async updateAthleteBankAccount(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id) {
        throw new ForbiddenError('Not authenticated');
      }

      const { athleteId } = req.params;
      const { bankName, accountNumber, accountHolder } = req.body;

      if (!bankName || !accountNumber || !accountHolder) {
        throw new BadRequestError('Bank name, account number, and account holder are required');
      }

      const athlete = await agencyService.updateAthleteBankAccount(req.user.id, athleteId, {
        bankName,
        accountNumber,
        accountHolder,
      });

      sendSuccess(res, athlete);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /agencies/athletes/:athleteId/settlements - 선수 정산 내역 조회
   */
  async getAthleteSettlements(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id) {
        throw new ForbiddenError('Not authenticated');
      }

      const { athleteId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await agencyService.getAthleteSettlements(req.user.id, athleteId, page, limit);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /agencies/athletes/:athleteId/withdrawals - 선수 출금 내역 조회
   */
  async getAthleteWithdrawals(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id) {
        throw new ForbiddenError('Not authenticated');
      }

      const { athleteId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await agencyService.getAthleteWithdrawals(req.user.id, athleteId, page, limit);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /agencies/athletes/:athleteId/contracts - 선수 계약 내역 조회
   */
  async getAthleteContracts(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id) {
        throw new ForbiddenError('Not authenticated');
      }

      const { athleteId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string | undefined;

      const result = await agencyService.getAthleteContracts(req.user.id, athleteId, page, limit, status);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /agencies/athletes/:athleteId/performance - 선수 성과 통계 조회
   */
  async getAthletePerformance(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id) {
        throw new ForbiddenError('Not authenticated');
      }

      const { athleteId } = req.params;
      const performance = await agencyService.getAthletePerformance(req.user.id, athleteId);
      sendSuccess(res, performance);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /agencies/athletes/performance - 모든 관리 선수의 성과 조회
   */
  async getAllAthletesPerformance(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id || !req.user?.agencyId) {
        throw new ForbiddenError('Not authenticated as agency');
      }

      const performances = await agencyService.getAllAthletesPerformance(
        req.user.agencyId,
        req.user.id
      );

      sendSuccess(res, performances);
    } catch (error) {
      next(error);
    }
  }
}

export const agencyController = new AgencyController();
