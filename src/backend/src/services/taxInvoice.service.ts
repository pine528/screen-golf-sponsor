/**
 * Phase 11-2A: Tax Invoice Service
 * 세금계산서 발행 요청 워크플로우
 */

import { PrismaClient, TaxInvoiceStatus, Prisma } from '@prisma/client';
import { statementsService } from './statements.service';

const prisma = new PrismaClient();

interface TaxInvoiceRequestInput {
  billingProfileId: string;
  fromDate: Date;
  toDate: Date;
  idempotencyKey: string;
}

interface TaxInvoiceListParams {
  status?: TaxInvoiceStatus;
  page?: number;
  pageSize?: number;
}

class TaxInvoiceService {
  /**
   * 세금계산서 발행 요청 (Brand)
   */
  async requestTaxInvoice(brandId: string, input: TaxInvoiceRequestInput) {
    // 1. 청구 프로필 확인 (본인 소유)
    const billingProfile = await prisma.billingProfile.findUnique({
      where: { id: input.billingProfileId },
    });

    if (!billingProfile) {
      throw new Error('청구 프로필을 찾을 수 없습니다.');
    }

    if (billingProfile.brandId !== brandId) {
      throw new Error('본인의 청구 프로필만 사용할 수 있습니다.');
    }

    // 2. 기간 내 거래 요약 조회
    const summary = await statementsService.getSummary(
      brandId,
      input.fromDate,
      input.toDate
    );

    // 3. 공급가액/세액 계산 (VAT 10%)
    const totalAmount = BigInt(Math.abs(summary.netSpend));
    const supplyAmount = (totalAmount * BigInt(100)) / BigInt(110); // 공급가액
    const taxAmount = totalAmount - supplyAmount; // 세액

    // 4. 중복 요청 방지 (idempotencyKey)
    try {
      const taxInvoice = await prisma.taxInvoiceRequest.create({
        data: {
          billingProfileId: input.billingProfileId,
          fromDate: input.fromDate,
          toDate: input.toDate,
          supplyAmount: new Prisma.Decimal(supplyAmount.toString()),
          taxAmount: new Prisma.Decimal(taxAmount.toString()),
          totalAmount: new Prisma.Decimal(totalAmount.toString()),
          status: TaxInvoiceStatus.REQUESTED,
          idempotencyKey: input.idempotencyKey,
        },
        include: {
          billingProfile: true,
        },
      });

      return taxInvoice;
    } catch (error: any) {
      if (error.code === 'P2002') {
        // 이미 존재하는 요청
        const existing = await prisma.taxInvoiceRequest.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          include: { billingProfile: true },
        });
        return existing;
      }
      throw error;
    }
  }

  /**
   * 내 세금계산서 요청 목록 (Brand)
   */
  async getMyTaxInvoices(brandId: string, params: TaxInvoiceListParams = {}) {
    const { status, page = 1, pageSize = 20 } = params;

    // 브랜드의 billingProfile 찾기
    const billingProfile = await prisma.billingProfile.findUnique({
      where: { brandId },
    });

    if (!billingProfile) {
      return { items: [], total: 0, page, pageSize };
    }

    const where: Prisma.TaxInvoiceRequestWhereInput = {
      billingProfileId: billingProfile.id,
      ...(status && { status }),
    };

    const [items, total] = await Promise.all([
      prisma.taxInvoiceRequest.findMany({
        where,
        orderBy: { requestedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.taxInvoiceRequest.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  /**
   * 모든 세금계산서 요청 목록 (Admin)
   */
  async getAllTaxInvoices(params: TaxInvoiceListParams = {}) {
    const { status, page = 1, pageSize = 20 } = params;

    const where: Prisma.TaxInvoiceRequestWhereInput = {
      ...(status && { status }),
    };

    const [items, total] = await Promise.all([
      prisma.taxInvoiceRequest.findMany({
        where,
        include: {
          billingProfile: {
            include: {
              brand: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { requestedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.taxInvoiceRequest.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  /**
   * 세금계산서 상세 조회 (Admin)
   */
  async getTaxInvoiceById(id: string) {
    const taxInvoice = await prisma.taxInvoiceRequest.findUnique({
      where: { id },
      include: {
        billingProfile: {
          include: {
            brand: {
              select: {
                id: true,
                name: true,
                contactEmail: true,
              },
            },
          },
        },
      },
    });

    if (!taxInvoice) {
      throw new Error('세금계산서 요청을 찾을 수 없습니다.');
    }

    return taxInvoice;
  }

  /**
   * 세금계산서 승인 (Admin)
   */
  async approveTaxInvoice(id: string, adminId: string) {
    const taxInvoice = await prisma.taxInvoiceRequest.findUnique({
      where: { id },
    });

    if (!taxInvoice) {
      throw new Error('세금계산서 요청을 찾을 수 없습니다.');
    }

    if (taxInvoice.status !== TaxInvoiceStatus.REQUESTED) {
      throw new Error(`현재 상태(${taxInvoice.status})에서는 승인할 수 없습니다.`);
    }

    return prisma.taxInvoiceRequest.update({
      where: { id },
      data: {
        status: TaxInvoiceStatus.APPROVED,
        approvedBy: adminId,
        approvedAt: new Date(),
      },
    });
  }

  /**
   * 세금계산서 거부 (Admin)
   */
  async rejectTaxInvoice(id: string, adminId: string, reason: string) {
    if (!reason || reason.length < 10) {
      throw new Error('거부 사유는 10자 이상 입력해야 합니다.');
    }

    const taxInvoice = await prisma.taxInvoiceRequest.findUnique({
      where: { id },
    });

    if (!taxInvoice) {
      throw new Error('세금계산서 요청을 찾을 수 없습니다.');
    }

    if (taxInvoice.status !== TaxInvoiceStatus.REQUESTED) {
      throw new Error(`현재 상태(${taxInvoice.status})에서는 거부할 수 없습니다.`);
    }

    return prisma.taxInvoiceRequest.update({
      where: { id },
      data: {
        status: TaxInvoiceStatus.REJECTED,
        rejectedBy: adminId,
        rejectedAt: new Date(),
        rejectionReason: reason,
      },
    });
  }

  /**
   * 세금계산서 발행 (Admin - Danger Zone)
   * confirmText가 "ISSUE"와 정확히 일치해야 함
   */
  async issueTaxInvoice(
    id: string,
    adminId: string,
    invoiceNumber: string,
    confirmText: string
  ) {
    // Danger Zone 확인
    if (confirmText !== 'ISSUE') {
      throw new Error('확인 텍스트가 올바르지 않습니다. "ISSUE"를 입력해주세요.');
    }

    if (!invoiceNumber || invoiceNumber.trim().length === 0) {
      throw new Error('세금계산서 번호를 입력해야 합니다.');
    }

    const taxInvoice = await prisma.taxInvoiceRequest.findUnique({
      where: { id },
    });

    if (!taxInvoice) {
      throw new Error('세금계산서 요청을 찾을 수 없습니다.');
    }

    if (taxInvoice.status !== TaxInvoiceStatus.APPROVED) {
      throw new Error(`승인된 상태에서만 발행할 수 있습니다. 현재 상태: ${taxInvoice.status}`);
    }

    // 중복 발행번호 체크
    const existingInvoice = await prisma.taxInvoiceRequest.findUnique({
      where: { invoiceNumber },
    });

    if (existingInvoice) {
      throw new Error('이미 사용된 세금계산서 번호입니다.');
    }

    return prisma.taxInvoiceRequest.update({
      where: { id },
      data: {
        status: TaxInvoiceStatus.ISSUED,
        issuedBy: adminId,
        issuedAt: new Date(),
        invoiceNumber: invoiceNumber.trim(),
      },
    });
  }

  /**
   * 세금계산서 통계 (Admin Dashboard)
   */
  async getTaxInvoiceStats() {
    const [requested, approved, issued, rejected] = await Promise.all([
      prisma.taxInvoiceRequest.count({ where: { status: TaxInvoiceStatus.REQUESTED } }),
      prisma.taxInvoiceRequest.count({ where: { status: TaxInvoiceStatus.APPROVED } }),
      prisma.taxInvoiceRequest.count({ where: { status: TaxInvoiceStatus.ISSUED } }),
      prisma.taxInvoiceRequest.count({ where: { status: TaxInvoiceStatus.REJECTED } }),
    ]);

    return { requested, approved, issued, rejected, total: requested + approved + issued + rejected };
  }
}

export const taxInvoiceService = new TaxInvoiceService();
