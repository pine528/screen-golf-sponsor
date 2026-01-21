import prisma from '../models/prisma';
import config from '../config';
import { NotFoundError, BadRequestError, ConflictError } from '../utils/errors';
import { SettlementStatus } from '@prisma/client';

export class SettlementService {
  /**
   * Create settlement after contract is verified
   */
  async createFromContract(contractId: string): Promise<any> {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        settlement: true,
        athlete: true,
      },
    });

    if (!contract) {
      throw new NotFoundError('Contract not found');
    }

    if (contract.status !== 'VERIFIED') {
      throw new BadRequestError('Contract is not verified');
    }

    if (contract.settlement) {
      throw new ConflictError('Settlement already exists for this contract');
    }

    // Calculate fees and payout
    const grossAmount = contract.priceFinal;
    const platformFeeRate = config.platform.feeRate;
    const platformFee = Math.floor(grossAmount * platformFeeRate);
    const payoutAmount = grossAmount - platformFee;

    const settlement = await prisma.settlement.create({
      data: {
        contractId,
        grossAmount,
        platformFee,
        platformFeeRate,
        payoutAmount,
        status: 'PENDING',
      },
      include: {
        contract: {
          include: {
            brand: true,
            athlete: true,
            auction: {
              include: {
                slotInstance: {
                  include: {
                    event: true,
                    slotTemplate: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return settlement;
  }

  async findById(id: string) {
    const settlement = await prisma.settlement.findUnique({
      where: { id },
      include: {
        contract: {
          include: {
            brand: true,
            athlete: true,
            auction: {
              include: {
                slotInstance: {
                  include: {
                    event: true,
                    slotTemplate: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!settlement) {
      throw new NotFoundError('Settlement not found');
    }

    return settlement;
  }

  async list(filters: {
    status?: SettlementStatus;
    athleteId?: string;
    page?: number;
    limit?: number;
  }) {
    const { status, athleteId, page = 1, limit = 20 } = filters;

    const where: any = {};
    if (status) where.status = status;
    if (athleteId) where.contract = { athleteId };

    const [settlements, total] = await Promise.all([
      prisma.settlement.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          contract: {
            include: {
              brand: {
                select: { id: true, name: true },
              },
              athlete: {
                select: { id: true, name: true },
              },
              auction: {
                include: {
                  slotInstance: {
                    include: {
                      event: true,
                      slotTemplate: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.settlement.count({ where }),
    ]);

    return { settlements, total };
  }

  async processPayment(id: string, paymentRef?: string) {
    const settlement = await prisma.settlement.findUnique({
      where: { id },
      include: { contract: true },
    });

    if (!settlement) {
      throw new NotFoundError('Settlement not found');
    }

    if (settlement.status !== 'PENDING') {
      throw new BadRequestError('Settlement is not pending');
    }

    // Update settlement status to processing
    await prisma.settlement.update({
      where: { id },
      data: { status: 'PROCESSING' },
    });

    // In production, this would integrate with payment gateway
    // For now, simulate successful payment after validation

    const updated = await prisma.settlement.update({
      where: { id },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        paymentRef: paymentRef || `PAY-${Date.now()}`,
      },
    });

    // Update contract status to completed
    await prisma.contract.update({
      where: { id: settlement.contractId },
      data: { status: 'COMPLETED' },
    });

    return updated;
  }

  async markFailed(id: string, reason?: string) {
    return prisma.settlement.update({
      where: { id },
      data: {
        status: 'FAILED',
      },
    });
  }

  async refund(id: string, reason?: string) {
    const settlement = await prisma.settlement.findUnique({ where: { id } });

    if (!settlement) {
      throw new NotFoundError('Settlement not found');
    }

    if (settlement.status !== 'PAID') {
      throw new BadRequestError('Only paid settlements can be refunded');
    }

    return prisma.settlement.update({
      where: { id },
      data: { status: 'REFUNDED' },
    });
  }

  async getByAthlete(athleteId: string) {
    return prisma.settlement.findMany({
      where: { contract: { athleteId } },
      orderBy: { createdAt: 'desc' },
      include: {
        contract: {
          include: {
            brand: {
              select: { id: true, name: true },
            },
            auction: {
              include: {
                slotInstance: {
                  include: {
                    event: true,
                    slotTemplate: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  async getAthleteStats(athleteId: string) {
    const [athlete, totalPaid, pendingAmount, thisMonth, settlementCount] = await Promise.all([
      prisma.athlete.findUnique({
        where: { id: athleteId },
        select: { bankAccount: true },
      }),
      prisma.settlement.aggregate({
        where: {
          contract: { athleteId },
          status: 'PAID',
        },
        _sum: { payoutAmount: true },
      }),
      prisma.settlement.aggregate({
        where: {
          contract: { athleteId },
          status: 'PENDING',
        },
        _sum: { payoutAmount: true },
      }),
      prisma.settlement.aggregate({
        where: {
          contract: { athleteId },
          status: 'PAID',
          paidAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
        _sum: { payoutAmount: true },
      }),
      prisma.settlement.count({
        where: { contract: { athleteId } },
      }),
    ]);

    // bankAccount는 JSON: { bankName, accountNumber, accountHolder }
    const bankInfo = (athlete?.bankAccount as any) || {};

    return {
      totalPaid: totalPaid._sum.payoutAmount || 0,
      pendingAmount: pendingAmount._sum.payoutAmount || 0,
      thisMonth: thisMonth._sum.payoutAmount || 0,
      settlementCount,
      bankName: bankInfo.bankName || null,
      bankAccount: bankInfo.accountNumber || null,
      bankHolder: bankInfo.accountHolder || null,
    };
  }

  async getMonthlySettlements(athleteId: string) {
    const settlements = await prisma.settlement.findMany({
      where: { contract: { athleteId } },
      orderBy: { createdAt: 'desc' },
    });

    // Group by month
    const monthlyMap = new Map<string, { amount: number; count: number; status: string }>();

    for (const settlement of settlements) {
      const date = new Date(settlement.createdAt);
      const key = `${date.getFullYear()}년 ${date.getMonth() + 1}월`;

      const existing = monthlyMap.get(key) || { amount: 0, count: 0, status: 'pending' };
      existing.amount += settlement.payoutAmount;
      existing.count += 1;

      // Determine overall status for the month
      if (settlement.status === 'PAID') {
        existing.status = 'completed';
      } else if (settlement.status === 'PENDING' && existing.status !== 'completed') {
        existing.status = 'pending';
      }

      monthlyMap.set(key, existing);
    }

    return Array.from(monthlyMap.entries()).map(([month, data]) => ({
      month,
      amount: data.amount,
      count: data.count,
      status: data.status,
    }));
  }

  async generateReport(athleteId: string, year: number, month: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const settlements = await prisma.settlement.findMany({
      where: {
        contract: { athleteId },
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        contract: {
          include: {
            brand: { select: { name: true } },
            auction: {
              include: {
                slotInstance: {
                  include: {
                    event: true,
                    slotTemplate: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const totalAmount = settlements.reduce((sum, s) => sum + s.payoutAmount, 0);
    const totalFee = settlements.reduce((sum, s) => sum + s.platformFee, 0);

    return {
      period: `${year}년 ${month}월`,
      generatedAt: new Date(),
      summary: {
        totalSettlements: settlements.length,
        totalGrossAmount: totalAmount + totalFee,
        totalPlatformFee: totalFee,
        totalPayoutAmount: totalAmount,
      },
      settlements: settlements.map(s => ({
        id: s.id,
        brandName: s.contract.brand.name,
        eventName: s.contract.auction?.slotInstance?.event?.name || 'N/A',
        slotName: s.contract.auction?.slotInstance?.slotTemplate?.name || 'N/A',
        grossAmount: s.grossAmount,
        platformFee: s.platformFee,
        payoutAmount: s.payoutAmount,
        status: s.status,
        paidAt: s.paidAt,
        createdAt: s.createdAt,
      })),
    };
  }

  async getPendingSettlements() {
    return prisma.settlement.findMany({
      where: { status: 'PENDING' },
      include: {
        contract: {
          include: {
            brand: true,
            athlete: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // Scheduled job: Process settlements for verified contracts older than D+7
  async processReadySettlements() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const ready = await prisma.contract.findMany({
      where: {
        status: 'VERIFIED',
        updatedAt: { lte: sevenDaysAgo },
        settlement: null,
      },
    });

    for (const contract of ready) {
      try {
        await this.createFromContract(contract.id);
      } catch (error) {
        console.error(`Failed to create settlement for contract ${contract.id}:`, error);
      }
    }

    return ready.length;
  }
}

export const settlementService = new SettlementService();
