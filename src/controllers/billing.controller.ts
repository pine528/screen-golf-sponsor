import { Response, NextFunction } from 'express';
import { billingProfileService } from '../services/billingProfile.service';
import { statementsService } from '../services/statements.service';
import { sendSuccess, sendPaginated } from '../utils/response';
import { AuthRequest } from '../types';
import { BadRequestError } from '../utils/errors';

export class BillingController {
  // ============================================
  // Billing Profile
  // ============================================

  /**
   * 청구 프로필 조회
   */
  async getBillingProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.brandId) {
        throw new BadRequestError('브랜드 계정이 아닙니다');
      }
      const profile = await billingProfileService.getByBrandId(req.user.brandId);
      sendSuccess(res, profile);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 청구 프로필 생성
   */
  async createBillingProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.brandId) {
        throw new BadRequestError('브랜드 계정이 아닙니다');
      }

      const {
        businessName,
        businessNumber,
        representativeName,
        businessType,
        businessCategory,
        billingEmail,
        billingPhone,
        address,
        addressDetail,
      } = req.body;

      // 필수 필드 검증
      if (!businessName || !businessNumber || !representativeName || !billingEmail || !address) {
        throw new BadRequestError('필수 필드가 누락되었습니다 (상호, 사업자등록번호, 대표자명, 이메일, 주소)');
      }

      const profile = await billingProfileService.create(req.user.brandId, {
        businessName,
        businessNumber,
        representativeName,
        businessType,
        businessCategory,
        billingEmail,
        billingPhone,
        address,
        addressDetail,
      });

      sendSuccess(res, profile, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 청구 프로필 수정
   */
  async updateBillingProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.brandId) {
        throw new BadRequestError('브랜드 계정이 아닙니다');
      }

      const profile = await billingProfileService.update(req.user.brandId, req.body);
      sendSuccess(res, profile);
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // Statements
  // ============================================

  /**
   * 기간별 요약 조회
   */
  async getStatementSummary(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.brandId) {
        throw new BadRequestError('브랜드 계정이 아닙니다');
      }

      const { from, to } = req.query;
      if (!from || !to) {
        throw new BadRequestError('from, to 파라미터가 필요합니다 (YYYY-MM-DD)');
      }

      const fromDate = new Date(from as string);
      const toDate = new Date(to as string);

      // 날짜 유효성 검증
      if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
        throw new BadRequestError('올바른 날짜 형식이 아닙니다 (YYYY-MM-DD)');
      }

      // toDate를 해당 날짜의 마지막 시간으로 설정
      toDate.setHours(23, 59, 59, 999);

      const summary = await statementsService.getSummary(req.user.brandId, fromDate, toDate);
      sendSuccess(res, summary);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 거래 내역 조회 (페이지네이션)
   */
  async getStatementItems(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.brandId) {
        throw new BadRequestError('브랜드 계정이 아닙니다');
      }

      const { from, to, page = '1', pageSize = '20' } = req.query;
      if (!from || !to) {
        throw new BadRequestError('from, to 파라미터가 필요합니다 (YYYY-MM-DD)');
      }

      const fromDate = new Date(from as string);
      const toDate = new Date(to as string);

      if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
        throw new BadRequestError('올바른 날짜 형식이 아닙니다 (YYYY-MM-DD)');
      }

      toDate.setHours(23, 59, 59, 999);

      const result = await statementsService.getItems(
        req.user.brandId,
        fromDate,
        toDate,
        parseInt(page as string),
        parseInt(pageSize as string)
      );

      sendPaginated(res, result.items, result.pagination.page, result.pagination.pageSize, result.pagination.total);
    } catch (error) {
      next(error);
    }
  }

  /**
   * CSV 내보내기
   */
  async exportStatementCsv(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.brandId) {
        throw new BadRequestError('브랜드 계정이 아닙니다');
      }

      const { from, to } = req.query;
      if (!from || !to) {
        throw new BadRequestError('from, to 파라미터가 필요합니다 (YYYY-MM-DD)');
      }

      const fromDate = new Date(from as string);
      const toDate = new Date(to as string);

      if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
        throw new BadRequestError('올바른 날짜 형식이 아닙니다 (YYYY-MM-DD)');
      }

      toDate.setHours(23, 59, 59, 999);

      const ipAddress = req.ip || req.headers['x-forwarded-for']?.toString();

      const csv = await statementsService.exportCsv(
        req.user.brandId,
        req.user.id,
        fromDate,
        toDate,
        ipAddress
      );

      // 파일명 생성
      const fileName = `statement_${from}_${to}.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(csv);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PDF 내보내기
   */
  async exportStatementPdf(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.brandId) {
        throw new BadRequestError('브랜드 계정이 아닙니다');
      }

      const { from, to } = req.query;
      if (!from || !to) {
        throw new BadRequestError('from, to 파라미터가 필요합니다 (YYYY-MM-DD)');
      }

      const fromDate = new Date(from as string);
      const toDate = new Date(to as string);

      if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
        throw new BadRequestError('올바른 날짜 형식이 아닙니다 (YYYY-MM-DD)');
      }

      toDate.setHours(23, 59, 59, 999);

      const ipAddress = req.ip || req.headers['x-forwarded-for']?.toString();

      const pdfBuffer = await statementsService.exportPdf(
        req.user.brandId,
        req.user.id,
        fromDate,
        toDate,
        ipAddress
      );

      // 파일명 생성
      const fileName = `statement_${from}_${to}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(pdfBuffer);
    } catch (error) {
      next(error);
    }
  }
}

export const billingController = new BillingController();
