import prisma from '../models/prisma';
import { NotFoundError, ForbiddenError } from '../utils/errors';
import { CampaignStatus } from '@prisma/client';

export class CampaignService {
  async create(brandId: string, data: {
    name: string;
    description?: string;
    budget: number;
    targetCategories?: string[];
    excludedAthletes?: string[];
    preferredAthletes?: string[];
    dateStart: Date;
    dateEnd: Date;
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
        dateStart: data.dateStart,
        dateEnd: data.dateEnd,
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

    const totalBudget = campaigns.reduce((sum, c) => sum + c.budget, 0);
    const totalSpent = campaigns.reduce((sum, c) => sum + c.spentAmount, 0);
    const activeCampaigns = campaigns.filter(c => c.status === 'ACTIVE').length;

    return {
      totalCampaigns: campaigns.length,
      activeCampaigns,
      totalBudget,
      totalSpent,
      remainingBudget: totalBudget - totalSpent,
    };
  }
}

export const campaignService = new CampaignService();
