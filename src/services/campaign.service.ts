import basePrisma from '../models/prisma';
import { NotFoundError, ForbiddenError } from '../utils/errors';
import { CampaignStatus } from '@prisma/client';

// Cast prisma to any for new fields (will be typed after prisma generate)
const prisma = basePrisma as any;

export class CampaignService {
  async create(brandId: string, data: {
    name: string;
    description?: string;
    budget: number;
    targetCategories?: string[];
    excludedAthletes?: string[];
    preferredAthletes?: string[];
    dateStart?: Date;
    dateEnd?: Date;
  }) {
    return prisma.campaign.create({
      data: {
        brandId,
        name: data.name,
        description: data.description,
        budget: data.budget,
        spentAmount: 0,
        targetCategories: data.targetCategories || [],
        excludedAthletes: data.excludedAthletes || [],
        preferredAthletes: data.preferredAthletes || [],
        dateStart: data.dateStart || null,
        dateEnd: data.dateEnd || null,
        status: 'DRAFT',
      },
      include: {
        brand: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async findById(id: string) {
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        brand: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundError('Campaign not found');
    }

    return campaign;
  }

  async list(brandId?: string, page: number = 1, limit: number = 20, status?: string) {
    const where: any = {};
    if (brandId) where.brandId = brandId;
    if (status) where.status = status;

    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          brand: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.campaign.count({ where }),
    ]);

    return { campaigns, total };
  }

  async update(id: string, brandId: string, data: {
    name?: string;
    description?: string;
    budget?: number;
    targetCategories?: string[];
    excludedAthletes?: string[];
    preferredAthletes?: string[];
    dateStart?: Date;
    dateEnd?: Date;
    status?: CampaignStatus;
  }) {
    const campaign = await prisma.campaign.findUnique({ where: { id } });

    if (!campaign) {
      throw new NotFoundError('Campaign not found');
    }

    if (campaign.brandId !== brandId) {
      throw new ForbiddenError('Not authorized to update this campaign');
    }

    return prisma.campaign.update({
      where: { id },
      data,
      include: {
        brand: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async delete(id: string, brandId: string) {
    const campaign = await prisma.campaign.findUnique({ where: { id } });

    if (!campaign) {
      throw new NotFoundError('Campaign not found');
    }

    if (campaign.brandId !== brandId) {
      throw new ForbiddenError('Not authorized to delete this campaign');
    }

    return prisma.campaign.delete({ where: { id } });
  }

  async activate(id: string, brandId: string) {
    const campaign = await prisma.campaign.findUnique({ where: { id } });

    if (!campaign) {
      throw new NotFoundError('Campaign not found');
    }

    if (campaign.brandId !== brandId) {
      throw new ForbiddenError('Not authorized');
    }

    return prisma.campaign.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });
  }

  async pause(id: string, brandId: string) {
    const campaign = await prisma.campaign.findUnique({ where: { id } });

    if (!campaign) {
      throw new NotFoundError('Campaign not found');
    }

    if (campaign.brandId !== brandId) {
      throw new ForbiddenError('Not authorized');
    }

    return prisma.campaign.update({
      where: { id },
      data: { status: 'PAUSED' },
    });
  }

  async addSpending(id: string, amount: number) {
    return prisma.campaign.update({
      where: { id },
      data: {
        spentAmount: {
          increment: amount,
        },
      },
    });
  }

  async getStats(brandId: string) {
    const campaigns = await prisma.campaign.findMany({
      where: { brandId },
    });

    const totalBudget = campaigns.reduce((sum: number, c: any) => sum + c.budget, 0);
    const totalSpent = campaigns.reduce((sum: number, c: any) => sum + c.spentAmount, 0);
    const activeCampaigns = campaigns.filter((c: any) => c.status === 'ACTIVE').length;

    return {
      totalCampaigns: campaigns.length,
      activeCampaigns,
      totalBudget,
      totalSpent,
      remainingBudget: totalBudget - totalSpent,
    };
  }

  // ====================================
  // Phase E: Enhanced Campaign Features
  // ====================================

  /**
   * 캠페인 KPI/예산 설정 업데이트
   */
  async updateKpiAndBudget(
    id: string,
    brandId: string,
    data: {
      goalImpressions?: number;
      goalClicks?: number;
      goalConversions?: number;
      budgetAllocated?: number;
      dailyBudgetLimit?: number;
      preferredTours?: string[];
      minAthleteRating?: number;
    }
  ) {
    const campaign = await prisma.campaign.findUnique({ where: { id } });

    if (!campaign) {
      throw new NotFoundError('Campaign not found');
    }

    if (campaign.brandId !== brandId) {
      throw new ForbiddenError('Not authorized to update this campaign');
    }

    return prisma.campaign.update({
      where: { id },
      data,
      include: {
        brand: { select: { id: true, name: true } },
        contracts: {
          include: {
            contract: {
              select: {
                id: true,
                priceFinal: true,
                status: true,
                athlete: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });
  }

  /**
   * 캠페인 성과 조회
   */
  async getPerformance(id: string) {
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        contracts: {
          include: {
            contract: {
              include: {
                athlete: { select: { id: true, name: true, profileImageUrl: true } },
                escrow: { select: { status: true, grossAmount: true } },
              },
            },
          },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundError('Campaign not found');
    }

    // KPI 달성률 계산
    const kpiProgress = {
      impressions: {
        goal: campaign.goalImpressions || 0,
        actual: campaign.actualImpressions || 0,
        rate: campaign.goalImpressions
          ? Math.round((campaign.actualImpressions / campaign.goalImpressions) * 100)
          : 0,
      },
      clicks: {
        goal: campaign.goalClicks || 0,
        actual: campaign.actualClicks || 0,
        rate: campaign.goalClicks
          ? Math.round((campaign.actualClicks / campaign.goalClicks) * 100)
          : 0,
      },
      conversions: {
        goal: campaign.goalConversions || 0,
        actual: 0, // TODO: 실제 전환 추적 구현 필요
        rate: 0,
      },
    };

    // 예산 현황
    const budgetStatus = {
      total: campaign.budget,
      allocated: campaign.budgetAllocated,
      spent: campaign.spentAmount,
      remaining: campaign.budget - campaign.spentAmount,
      dailyLimit: campaign.dailyBudgetLimit,
      utilizationRate: Math.round((campaign.spentAmount / campaign.budget) * 100),
    };

    // 계약 현황
    const contractStats = {
      total: campaign.contracts.length,
      totalValue: campaign.contracts.reduce(
        (sum: number, cc: any) => sum + (cc.contract.priceFinal || 0),
        0
      ),
      byStatus: campaign.contracts.reduce((acc: Record<string, number>, cc: any) => {
        const status = cc.contract.status;
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    return {
      campaign,
      kpiProgress,
      budgetStatus,
      contractStats,
    };
  }

  /**
   * 캠페인에 계약 연결
   */
  async addContract(
    campaignId: string,
    brandId: string,
    contractId: string,
    allocatedBudget: number
  ) {
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });

    if (!campaign) {
      throw new NotFoundError('Campaign not found');
    }

    if (campaign.brandId !== brandId) {
      throw new ForbiddenError('Not authorized');
    }

    // 계약 확인
    const contract = await prisma.contract.findUnique({ where: { id: contractId } });
    if (!contract) {
      throw new NotFoundError('Contract not found');
    }

    if (contract.brandId !== brandId) {
      throw new ForbiddenError('Contract does not belong to this brand');
    }

    // 예산 확인
    const remainingBudget = campaign.budget - campaign.budgetAllocated;
    if (allocatedBudget > remainingBudget) {
      throw new Error('할당 예산이 남은 예산을 초과합니다');
    }

    return prisma.$transaction(async (tx: any) => {
      // 캠페인-계약 연결 생성
      const campaignContract = await tx.campaignContract.create({
        data: {
          campaignId,
          contractId,
          allocatedBudget,
        },
        include: {
          contract: {
            select: {
              id: true,
              priceFinal: true,
              status: true,
              athlete: { select: { id: true, name: true } },
            },
          },
        },
      });

      // 할당 예산 업데이트
      await tx.campaign.update({
        where: { id: campaignId },
        data: {
          budgetAllocated: { increment: allocatedBudget },
        },
      });

      return campaignContract;
    });
  }

  /**
   * 캠페인에서 계약 제거
   */
  async removeContract(campaignId: string, brandId: string, contractId: string) {
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });

    if (!campaign) {
      throw new NotFoundError('Campaign not found');
    }

    if (campaign.brandId !== brandId) {
      throw new ForbiddenError('Not authorized');
    }

    const campaignContract = await prisma.campaignContract.findUnique({
      where: {
        campaignId_contractId: { campaignId, contractId },
      },
    });

    if (!campaignContract) {
      throw new NotFoundError('Campaign contract not found');
    }

    return prisma.$transaction(async (tx: any) => {
      // 할당 예산 차감
      await tx.campaign.update({
        where: { id: campaignId },
        data: {
          budgetAllocated: { decrement: campaignContract.allocatedBudget },
        },
      });

      // 연결 삭제
      return tx.campaignContract.delete({
        where: {
          campaignId_contractId: { campaignId, contractId },
        },
      });
    });
  }

  /**
   * 추천 선수 조회
   */
  async getRecommendedAthletes(
    brandId: string,
    options?: {
      tours?: string[];
      minRating?: number;
      excludeAthleteIds?: string[];
      limit?: number;
    }
  ) {
    const limit = options?.limit || 10;

    // 기본 조건: 활성화된 선수, KYC 승인됨
    const where: any = {
      kycStatus: 'APPROVED',
    };

    // 투어 필터
    if (options?.tours && options.tours.length > 0) {
      where.tour = { in: options.tours };
    }

    // 제외할 선수 ID
    if (options?.excludeAthleteIds && options.excludeAthleteIds.length > 0) {
      where.id = { notIn: options.excludeAthleteIds };
    }

    const athletes = await prisma.athlete.findMany({
      where,
      take: limit,
      include: {
        user: { select: { email: true } },
        slotInstances: {
          where: {
            status: 'OPEN',
          },
          take: 3,
          include: {
            event: { select: { id: true, name: true, dateStart: true } },
            slotTemplate: { select: { name: true, bodyPart: true } },
          },
        },
        _count: {
          select: {
            contracts: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return athletes.map((a: any) => ({
      id: a.id,
      name: a.name,
      tour: a.tour,
      profileImageUrl: a.profileImageUrl,
      contractCount: a._count.contracts,
      availableSlots: a.slotInstances,
    }));
  }

  /**
   * 실적 업데이트 (노출/클릭)
   */
  async updateActuals(
    id: string,
    data: {
      impressions?: number;
      clicks?: number;
    }
  ) {
    const updateData: any = {};

    if (data.impressions !== undefined) {
      updateData.actualImpressions = { increment: data.impressions };
    }

    if (data.clicks !== undefined) {
      updateData.actualClicks = { increment: data.clicks };
    }

    return prisma.campaign.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * 캠페인 상세 조회 (계약 포함)
   */
  async findByIdWithContracts(id: string) {
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        brand: { select: { id: true, name: true } },
        contracts: {
          include: {
            contract: {
              include: {
                athlete: { select: { id: true, name: true, profileImageUrl: true, tour: true } },
                auction: {
                  select: {
                    slotInstance: {
                      select: {
                        event: { select: { name: true, dateStart: true } },
                        slotTemplate: { select: { name: true, bodyPart: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundError('Campaign not found');
    }

    return campaign;
  }
}

export const campaignService = new CampaignService();
