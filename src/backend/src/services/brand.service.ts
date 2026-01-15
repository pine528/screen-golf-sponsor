import prisma from '../models/prisma';
import { NotFoundError, ForbiddenError } from '../utils/errors';
import { KycStatus } from '@prisma/client';
import { kycVerificationService } from './kyc-verification.service';
import { settingsService } from './settings.service';

export class BrandService {
  async findById(id: string) {
    const brand = await prisma.brand.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
            createdAt: true,
          },
        },
        campaigns: true,
        _count: {
          select: {
            bids: true,
            contracts: true,
          },
        },
      },
    });

    if (!brand) {
      throw new NotFoundError('Brand not found');
    }

    // 프론트엔드가 기대하는 필드명으로 변환하여 반환
    return {
      ...brand,
      companyName: brand.name,
      businessNumber: brand.bizNo,
      industry: brand.category,
    };
  }

  async findByUserId(userId: string) {
    const brand = await prisma.brand.findUnique({
      where: { userId },
    });

    if (!brand) {
      throw new NotFoundError('Brand not found');
    }

    return brand;
  }

  async list(page: number = 1, limit: number = 20, filters?: { kycStatus?: KycStatus; category?: string }) {
    const where: any = {};
    if (filters?.kycStatus) where.kycStatus = filters.kycStatus;
    if (filters?.category) where.category = filters.category;

    const [brands, total] = await Promise.all([
      prisma.brand.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              bids: true,
              contracts: true,
            },
          },
        },
      }),
      prisma.brand.count({ where }),
    ]);

    return { brands, total };
  }

  async update(id: string, userId: string, data: {
    name?: string;
    companyName?: string;
    category?: string;
    industry?: string;
    contactEmail?: string;
    contactPhone?: string;
    contactName?: string;
    bizNo?: string;
    businessNumber?: string;
    website?: string;
    description?: string;
    address?: string;
  }) {
    const brand = await prisma.brand.findUnique({ where: { id } });

    if (!brand) {
      throw new NotFoundError('Brand not found');
    }

    if (brand.userId !== userId) {
      throw new ForbiddenError('Not authorized to update this brand');
    }

    // 프론트엔드 필드명을 DB 필드명으로 매핑
    const updateData: any = {};

    // undefined가 아닌 경우에만 업데이트 (빈 문자열도 허용)
    if (data.name !== undefined) updateData.name = data.name;
    if (data.companyName !== undefined) updateData.name = data.companyName;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.industry !== undefined) updateData.category = data.industry;
    if (data.contactEmail !== undefined) updateData.contactEmail = data.contactEmail;
    if (data.contactPhone !== undefined) updateData.contactPhone = data.contactPhone;
    if (data.contactName !== undefined) updateData.contactName = data.contactName;
    if (data.bizNo !== undefined) updateData.bizNo = data.bizNo;
    if (data.businessNumber !== undefined) updateData.bizNo = data.businessNumber;
    if (data.website !== undefined) updateData.website = data.website;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.address !== undefined) updateData.address = data.address;

    return prisma.brand.update({
      where: { id },
      data: updateData,
    });
  }

  async updateKycStatus(id: string, status: KycStatus, documents?: any) {
    return prisma.brand.update({
      where: { id },
      data: {
        kycStatus: status,
        kycDocuments: documents,
      },
    });
  }

  async submitKyc(
    userId: string,
    documents: { type: string; url: string }[],
    businessNumber?: string
  ) {
    const brand = await prisma.brand.findUnique({ where: { userId } });

    if (!brand) {
      throw new NotFoundError('Brand not found');
    }

    if (brand.kycStatus === 'APPROVED') {
      throw new ForbiddenError('KYC already approved');
    }

    // 사업자등록번호가 제공된 경우 자동 검증
    let verificationResult = null;
    let autoApproved = false;

    // 관리자 설정에서 자동 승인 여부 확인
    const autoApproveEnabled = await settingsService.getBoolean('KYC_AUTO_APPROVE_ENABLED');

    if (businessNumber) {
      const verification = await kycVerificationService.verifyBrandKyc({
        businessNumber,
        companyName: brand.name,
      });

      verificationResult = verification.results;

      // 자동 승인 조건: 설정이 켜져 있고, 사업자등록번호가 유효한 계속사업자
      if (autoApproveEnabled && verification.autoApprove) {
        autoApproved = true;
      }
    }

    const kycData = {
      documents,
      businessNumber: businessNumber || null,
      verification: verificationResult ? JSON.parse(JSON.stringify(verificationResult)) : null,
      autoApproved,
      submittedAt: new Date().toISOString(),
    };

    // 자동 승인이 켜져 있고 검증 통과한 경우에만 APPROVED, 그 외에는 PENDING
    return prisma.brand.update({
      where: { id: brand.id },
      data: {
        kycStatus: autoApproved ? 'APPROVED' : 'PENDING',
        kycDocuments: kycData,
      },
    });
  }

  async addPenalty(id: string, points: number) {
    return prisma.brand.update({
      where: { id },
      data: {
        penaltyScore: {
          increment: points,
        },
      },
    });
  }

  async getStats(brandId: string) {
    const [bidsCount, contractsCount, totalSpent] = await Promise.all([
      prisma.bid.count({ where: { brandId } }),
      prisma.contract.count({ where: { brandId } }),
      prisma.contract.aggregate({
        where: { brandId, status: 'COMPLETED' },
        _sum: { priceFinal: true },
      }),
    ]);

    return {
      totalBids: bidsCount,
      totalContracts: contractsCount,
      totalSpent: totalSpent._sum.priceFinal || 0,
    };
  }
}

export const brandService = new BrandService();
