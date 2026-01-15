import { Request, Response, NextFunction } from 'express';
import { paymentService } from '../services/payment.service';
import { AuthenticatedRequest } from '../types';
import { brandService } from '../services/brand.service';

export class PaymentController {
  // ============================================
  // Payment 생성 및 조회
  // ============================================

  async createPayment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      // 브랜드 ID 가져오기
      const brand = await brandService.findByUserId(req.user!.id);

      const payment = await paymentService.createPayment(brand.id, {
        contractId: req.body.contractId,
        amount: req.body.amount,
        method: req.body.method,
      });

      res.status(201).json({
        success: true,
        data: payment,
      });
    } catch (error) {
      next(error);
    }
  }

  async getPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const payment = await paymentService.findById(req.params.id);

      res.json({
        success: true,
        data: payment,
      });
    } catch (error) {
      next(error);
    }
  }

  async listPayments(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const brandId = req.query.brandId as string;
      const status = req.query.status as any;
      const method = req.query.method as any;

      const result = await paymentService.list(page, limit, {
        brandId,
        status,
        method,
      });

      res.json({
        success: true,
        data: result.payments,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getMyPayments(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const brand = await brandService.findByUserId(req.user!.id);
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await paymentService.getMyPayments(brand.id, page, limit);

      res.json({
        success: true,
        data: result.payments,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // PG 연동
  // ============================================

  async initiatePayment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const payment = await paymentService.initiatePayment(
        req.params.id,
        req.body.pgProvider || 'toss'
      );

      res.json({
        success: true,
        data: payment,
        message: 'Payment initiated. Redirect to PG.',
      });
    } catch (error) {
      next(error);
    }
  }

  async completePayment(req: Request, res: Response, next: NextFunction) {
    try {
      // PG 웹훅 또는 클라이언트 콜백에서 호출
      const payment = await paymentService.completePayment(req.params.id, {
        success: req.body.success,
        transactionId: req.body.transactionId,
        message: req.body.message,
        errorCode: req.body.errorCode,
      });

      res.json({
        success: true,
        data: payment,
        message: payment.status === 'COMPLETED' ? 'Payment completed' : 'Payment failed',
      });
    } catch (error) {
      next(error);
    }
  }

  async refundPayment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const payment = await paymentService.refundPayment(
        req.params.id,
        req.body.refundAmount
      );

      res.json({
        success: true,
        data: payment,
        message: 'Payment refunded',
      });
    } catch (error) {
      next(error);
    }
  }

  async cancelPayment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const payment = await paymentService.cancelPayment(req.params.id);

      res.json({
        success: true,
        data: payment,
        message: 'Payment cancelled',
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // 통계
  // ============================================

  async getPaymentStats(req: Request, res: Response, next: NextFunction) {
    try {
      const brandId = req.query.brandId as string | undefined;
      const startDate = req.query.startDate
        ? new Date(req.query.startDate as string)
        : undefined;
      const endDate = req.query.endDate
        ? new Date(req.query.endDate as string)
        : undefined;

      const stats = await paymentService.getPaymentStats({
        brandId,
        startDate,
        endDate,
      });

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  async getDailyPaymentStats(req: Request, res: Response, next: NextFunction) {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const stats = await paymentService.getDailyPaymentStats(days);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const paymentController = new PaymentController();
