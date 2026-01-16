import prisma from '../models/prisma';
import { NotFoundError, ForbiddenError } from '../utils/errors';
import { KycStatus } from '@prisma/client';

export class AthleteService {
  async findById(id: string) {
    const athlete = await prisma.athlete.findUnique({
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
        slotInstances: {
          include: {
            slotTemplate: true,
            event: true,
          },
        },
        eventParticipations: {
          include: {
            event: true,
          },
        },
        _count: {
          select: {
            contracts: true,
            slotInstances: true,
          },
        },
      },
    });

    if (!athlete) {
      throw new NotFoundError('Athlete not found');
    }

    return athlete;
  }

  async findByUserId(userId: string) {
    const athlete = await prisma.athlete.findUnique({
      where: { userId },
    });

    if (!athlete) {
      throw new NotFoundError('Athlete not found');
    }

    return athlete;
  }

  async list(page: number = 1, limit: number = 20, filters?: {
    tour?: string;
    kycStatus?: KycStatus;
  }) {
    const where: any = {};
    if (filters?.tour) where.tour = filters.tour;
    if (filters?.kycStatus) where.kycStatus = filters.kycStatus;

    const [athletes, total] = await Promise.all([
      prisma.athlete.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              contracts: true,
              slotInstances: true,
            },
          },
        },
      }),
      prisma.athlete.count({ where }),
    ]);

    return { athletes, total };
  }

  async update(id: string, userId: string, data: {
    name?: string;
    displayName?: string;
    realName?: string;
    bio?: string;
    profileImageUrl?: string;
    socialLinks?: Record<string, string>;
    socialMedia?: string;
    blockedCategories?: string[];
    primarySponsors?: any;
    bankName?: string;
    bankAccount?: string;
    bankHolder?: string;
  }) {
    const athlete = await prisma.athlete.findUnique({ where: { id } });

    if (!athlete) {
      throw new NotFoundError('Athlete not found');
    }

    if (athlete.userId !== userId) {
      throw new ForbiddenError('Not authorized to update this athlete');
    }

    // 프론트엔드 필드명을 DB 필드명으로 매핑
    const updateData: any = {};

    // undefined가 아닌 경우에만 업데이트 (빈 문자열도 허용)
    if (data.name !== undefined) updateData.name = data.name;
    if (data.displayName !== undefined) updateData.name = data.displayName;
    if (data.realName !== undefined) updateData.realName = data.realName;
    if (data.bio !== undefined) updateData.bio = data.bio;
    if (data.profileImageUrl !== undefined) updateData.profileImageUrl = data.profileImageUrl;
    if (data.socialLinks !== undefined) updateData.socialLinks = data.socialLinks;
    if (data.socialMedia !== undefined) updateData.socialLinks = { instagram: data.socialMedia };
    if (data.blockedCategories !== undefined) updateData.blockedCategories = data.blockedCategories;
    if (data.primarySponsors !== undefined) updateData.primarySponsors = data.primarySponsors;

    // 은행 정보는 bankAccount JSON 필드에 저장
    if (data.bankName !== undefined || data.bankAccount !== undefined || data.bankHolder !== undefined) {
      const existingBankAccount = (athlete.bankAccount as any) || {};
      updateData.bankAccount = {
        ...existingBankAccount,
        bankName: data.bankName !== undefined ? data.bankName : existingBankAccount.bankName,
        accountNumber: data.bankAccount !== undefined ? data.bankAccount : existingBankAccount.accountNumber,
        accountHolder: data.bankHolder !== undefined ? data.bankHolder : existingBankAccount.accountHolder,
      };
    }

    return prisma.athlete.update({
      where: { id },
      data: updateData,
    });
  }

  async updateKycStatus(id: string, status: KycStatus, documents?: any) {
    return prisma.athlete.update({
      where: { id },
      data: {
        kycStatus: status,
        kycDocuments: documents,
      },
    });
  }

  async submitKyc(userId: string, documents: { type: string; url: string }[]) {
    const athlete = await prisma.athlete.findUnique({ where: { userId } });

    if (!athlete) {
      throw new NotFoundError('Athlete not found');
    }

    if (athlete.kycStatus === 'APPROVED') {
      throw new ForbiddenError('KYC already approved');
    }

    return prisma.athlete.update({
      where: { id: athlete.id },
      data: {
        kycStatus: 'PENDING',
        kycDocuments: {
          documents,
          submittedAt: new Date(),
        },
      },
    });
  }

  async updateBankInfo(id: string, userId: string, bankAccount: any, taxInfo?: any) {
    const athlete = await prisma.athlete.findUnique({ where: { id } });

    if (!athlete) {
      throw new NotFoundError('Athlete not found');
    }

    if (athlete.userId !== userId) {
      throw new ForbiddenError('Not authorized');
    }

    return prisma.athlete.update({
      where: { id },
      data: {
        bankAccount,
        taxInfo,
      },
    });
  }

  async updateSlotAvailability(id: string, userId: string, blockedCategories: string[]) {
    const athlete = await prisma.athlete.findUnique({ where: { id } });

    if (!athlete) {
      throw new NotFoundError('Athlete not found');
    }

    if (athlete.userId !== userId) {
      throw new ForbiddenError('Not authorized');
    }

    return prisma.athlete.update({
      where: { id },
      data: { blockedCategories },
    });
  }

  async getStats(athleteId: string) {
    const [contractsCount, totalEarnings, activeSlots] = await Promise.all([
      prisma.contract.count({ where: { athleteId } }),
      prisma.settlement.aggregate({
        where: {
          contract: { athleteId },
          status: 'PAID',
        },
        _sum: { payoutAmount: true },
      }),
      prisma.slotInstance.count({
        where: { athleteId, status: { in: ['OPEN', 'IN_AUCTION'] } },
      }),
    ]);

    return {
      totalContracts: contractsCount,
      totalEarnings: totalEarnings._sum.payoutAmount || 0,
      activeSlots,
    };
  }

  async getAvailableSlots(athleteId: string, eventId?: string) {
    const where: any = { athleteId, status: 'OPEN' };
    if (eventId) where.eventId = eventId;

    return prisma.slotInstance.findMany({
      where,
      include: {
        slotTemplate: true,
        event: true,
      },
    });
  }
}

export const athleteService = new AthleteService();
