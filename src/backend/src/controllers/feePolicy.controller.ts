import { Response, NextFunction } from 'express';
import { feePolicyService } from '../services/feePolicy.service';
import { sendSuccess, sendPaginated } from '../utils/response';
import { AuthRequest } from '../types';
import { FeePolicyType } from '@prisma/client';

export class FeePolicyController {
  /**
   * 공개 API: 현재 수수료 정책 요약 조회
   * GET /api/fan-votes/fee-info
   */
  async getFeeInfo(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const summary = await feePolicyService.getActivePolicySummary();
      sendSuccess(res, summary);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 수수료 시뮬레이션
   * POST /api/fan-votes/fee-simulate
   */
  async simulateFees(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { seedPoints, entryFee, participantCount } = req.body;
      const simulation = await feePolicyService.simulateFees(
        seedPoints,
        entryFee,
        participantCount
      );
      sendSuccess(res, simulation);
    } catch (error) {
      next(error);
    }
  }

  // ===============================================
  // Admin APIs
  // ===============================================

  /**
   * 정책 목록 조회
   * GET /api/admin/fee-policies
   */
  async listPolicies(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { type, activeOnly, page, pageSize } = req.query;

      const result = await feePolicyService.listPolicies({
        type: type as FeePolicyType | undefined,
        activeOnly: activeOnly === 'true',
        page: page ? parseInt(page as string, 10) : 1,
        pageSize: pageSize ? parseInt(pageSize as string, 10) : 20,
      });

      const pageNum = page ? parseInt(page as string, 10) : 1;
      const pageSizeNum = pageSize ? parseInt(pageSize as string, 10) : 20;
      sendPaginated(res, result.policies, pageNum, pageSizeNum, result.total);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 현재 활성 정책 조회
   * GET /api/admin/fee-policies/active
   */
  async getActivePolicies(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { type } = req.query;

      if (type) {
        const policy = await feePolicyService.getActivePolicy(type as FeePolicyType);
        sendSuccess(res, policy);
      } else {
        // 모든 타입의 활성 정책 조회
        const [openPolicy, entryPolicy, settlePolicy] = await Promise.all([
          feePolicyService.getActivePolicy(FeePolicyType.FAN_VOTE_OPEN),
          feePolicyService.getActivePolicy(FeePolicyType.FAN_VOTE_ENTRY),
          feePolicyService.getActivePolicy(FeePolicyType.FAN_VOTE_SETTLE),
        ]);

        sendSuccess(res, {
          [FeePolicyType.FAN_VOTE_OPEN]: openPolicy,
          [FeePolicyType.FAN_VOTE_ENTRY]: entryPolicy,
          [FeePolicyType.FAN_VOTE_SETTLE]: settlePolicy,
        });
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * 정책 상세 조회
   * GET /api/admin/fee-policies/:id
   */
  async getPolicy(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const policy = await feePolicyService.getPolicy(id);

      if (!policy) {
        res.status(404).json({ success: false, message: '정책을 찾을 수 없습니다' });
        return;
      }

      sendSuccess(res, policy);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 정책 생성
   * POST /api/admin/fee-policies
   */
  async createPolicy(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        type,
        ratePercent,
        minAmount,
        maxAmount,
        platformSharePercent,
        creatorSharePercent,
        effectiveFrom,
        effectiveTo,
        description,
      } = req.body;

      const policy = await feePolicyService.createPolicy({
        type,
        ratePercent,
        minAmount,
        maxAmount,
        platformSharePercent,
        creatorSharePercent,
        effectiveFrom: new Date(effectiveFrom),
        effectiveTo: effectiveTo ? new Date(effectiveTo) : undefined,
        description,
      });

      sendSuccess(res, policy, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 정책 수정
   * PATCH /api/admin/fee-policies/:id
   */
  async updatePolicy(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const {
        ratePercent,
        minAmount,
        maxAmount,
        platformSharePercent,
        creatorSharePercent,
        effectiveTo,
        description,
        isActive,
      } = req.body;

      const updateData: any = {};
      if (ratePercent !== undefined) updateData.ratePercent = ratePercent;
      if (minAmount !== undefined) updateData.minAmount = minAmount;
      if (maxAmount !== undefined) updateData.maxAmount = maxAmount;
      if (platformSharePercent !== undefined) updateData.platformSharePercent = platformSharePercent;
      if (creatorSharePercent !== undefined) updateData.creatorSharePercent = creatorSharePercent;
      if (effectiveTo !== undefined) updateData.effectiveTo = effectiveTo ? new Date(effectiveTo) : null;
      if (description !== undefined) updateData.description = description;
      if (isActive !== undefined) updateData.isActive = isActive;

      const policy = await feePolicyService.updatePolicy(id, updateData);
      sendSuccess(res, policy);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 정책 비활성화
   * DELETE /api/admin/fee-policies/:id
   */
  async deactivatePolicy(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const policy = await feePolicyService.deactivatePolicy(id);
      sendSuccess(res, policy);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin 시뮬레이션
   * POST /api/admin/fee-policies/simulate
   */
  async adminSimulate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { seedPoints, entryFee, participantCount } = req.body;
      const simulation = await feePolicyService.simulateFees(
        seedPoints,
        entryFee,
        participantCount
      );
      sendSuccess(res, simulation);
    } catch (error) {
      next(error);
    }
  }
}

export const feePolicyController = new FeePolicyController();
