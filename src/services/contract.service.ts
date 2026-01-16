import prisma from '../models/prisma';
import config from '../config';
import { NotFoundError, BadRequestError, ConflictError, ForbiddenError } from '../utils/errors';
import { ContractStatus, AssetStatus, VerificationStatus } from '@prisma/client';
import { escrowService, IdempotentResult, toNumber } from './escrow.service';
import { notificationService } from './notification.service';

/**
 * 에스크로 작업의 멱등성 결과를 안전하게 처리하는 헬퍼
 * - alreadyProcessed인 경우 조용히 무시
 * - 유니크 제약 위반(P2002)도 조용히 무시 (이미 처리됨)
 * - 실제 오류만 throw
 */
async function safeEscrowOperation<T>(
  operation: () => Promise<IdempotentResult<T>>,
  operationName: string,
  contractId: string
): Promise<{ data: T | null; success: boolean; alreadyProcessed: boolean }> {
  try {
    const result = await operation();
    if (result.alreadyProcessed) {
      console.log(`[Escrow] ${operationName} already processed for contract ${contractId}`);
    } else {
      console.log(`[Escrow] ${operationName} completed for contract ${contractId}`);
    }
    return { data: result.data, success: true, alreadyProcessed: result.alreadyProcessed };
  } catch (e: any) {
    // Prisma 유니크 제약 위반 = 이미 처리된 것으로 간주
    if (e?.code === 'P2002') {
      console.log(`[Escrow] ${operationName} skipped (unique constraint) for contract ${contractId}`);
      return { data: null, success: true, alreadyProcessed: true };
    }
    // 실제 오류는 로깅 후 조용히 실패 (트리거 재시도 가능)
    console.error(`[Escrow] ${operationName} failed for contract ${contractId}:`, e);
    return { data: null, success: false, alreadyProcessed: false };
  }
}

export class ContractService {
  /**
   * Create contract after auction ends
   */
  async createFromAuction(auctionId: string): Promise<any> {
    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        slotInstance: {
          include: {
            athlete: true,
          },
        },
        bids: {
          where: { isWinning: true },
          take: 1,
        },
        contract: true,
      },
    });

    if (!auction) {
      throw new NotFoundError('Auction not found');
    }

    if (auction.status !== 'ENDED') {
      throw new BadRequestError('Auction has not ended');
    }

    if (auction.contract) {
      throw new ConflictError('Contract already exists for this auction');
    }

    const winningBid = auction.bids[0];
    if (!winningBid) {
      throw new BadRequestError('No winning bid found');
    }

    // Calculate asset deadline (T+24h)
    const assetDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const contract = await prisma.contract.create({
      data: {
        auctionId,
        brandId: winningBid.brandId,
        athleteId: auction.slotInstance.athleteId,
        priceFinal: auction.currentPrice,
        status: 'PENDING_SIGNATURE',
        assetDeadline,
      },
      include: {
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
        brand: true,
        athlete: true,
      },
    });

    // 알림 발송: 계약 생성
    try {
      await notificationService.notifyContractCreated(contract.id);
    } catch (e) {
      console.error('Failed to send contract created notification:', e);
    }

    return contract;
  }

  async findById(id: string) {
    const contract = await prisma.contract.findUnique({
      where: { id },
      include: {
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
        brand: true,
        athlete: true,
        assets: true,
        verification: true,
        settlement: true,
      },
    });

    if (!contract) {
      throw new NotFoundError('Contract not found');
    }

    return contract;
  }

  async list(filters: {
    brandId?: string;
    athleteId?: string;
    status?: ContractStatus;
    page?: number;
    limit?: number;
  }) {
    const { brandId, athleteId, status, page = 1, limit = 20 } = filters;

    const where: any = {};
    if (brandId) where.brandId = brandId;
    if (athleteId) where.athleteId = athleteId;
    if (status) where.status = status;

    const [contracts, total] = await Promise.all([
      prisma.contract.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
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
          brand: {
            select: {
              id: true,
              name: true,
              category: true,
            },
          },
          athlete: {
            select: {
              id: true,
              name: true,
              tour: true,
            },
          },
        },
      }),
      prisma.contract.count({ where }),
    ]);

    return { contracts, total };
  }

  async sign(id: string, userId: string, userType: 'brand' | 'athlete') {
    const contract = await prisma.contract.findUnique({
      where: { id },
      include: { brand: true, athlete: true },
    });

    if (!contract) {
      throw new NotFoundError('Contract not found');
    }

    // Verify authorization
    if (userType === 'brand') {
      if (contract.brand.userId !== userId) {
        throw new ForbiddenError('Not authorized to sign this contract');
      }
    } else if (userType === 'athlete') {
      if (contract.athlete.userId !== userId) {
        throw new ForbiddenError('Not authorized to sign this contract');
      }
    }

    if (contract.status !== 'PENDING_SIGNATURE') {
      throw new BadRequestError('Contract is not pending signature');
    }

    // 양쪽 서명 로직: 브랜드/선수 각각 서명 시간 기록
    const now = new Date();
    const updateData: any = {};

    if (userType === 'brand') {
      if (contract.brandSignedAt) {
        throw new BadRequestError('Brand has already signed this contract');
      }
      updateData.brandSignedAt = now;
    } else if (userType === 'athlete') {
      if (contract.athleteSignedAt) {
        throw new BadRequestError('Athlete has already signed this contract');
      }
      updateData.athleteSignedAt = now;
    }

    // 양쪽 다 서명 완료되었는지 확인
    const willBothSign =
      (userType === 'brand' && contract.athleteSignedAt) ||
      (userType === 'athlete' && contract.brandSignedAt);

    if (willBothSign) {
      // 양쪽 서명 완료 → ASSET_PENDING으로 전환
      updateData.status = 'ASSET_PENDING';
      updateData.signedAt = now;
    }
    // 한쪽만 서명된 경우 status는 PENDING_SIGNATURE 유지

    const updatedContract = await prisma.contract.update({
      where: { id },
      data: updateData,
      include: {
        brand: { select: { id: true, name: true } },
        athlete: { select: { id: true, name: true } },
      },
    });

    // 양쪽 서명 완료 시 에스크로 홀드 (멱등성 보장)
    if (willBothSign) {
      await safeEscrowOperation(
        () => escrowService.holdFromContract(id),
        'holdFromContract',
        id
      );
    }

    return updatedContract;
  }

  async cancel(id: string, reason?: string) {
    const contract = await prisma.contract.findUnique({ where: { id } });

    if (!contract) {
      throw new NotFoundError('Contract not found');
    }

    if (contract.status === 'COMPLETED' || contract.status === 'CANCELLED') {
      throw new BadRequestError('Cannot cancel this contract');
    }

    // If cancelled due to missed deadline, add penalty to brand
    if (reason === 'ASSET_DEADLINE_MISSED') {
      await prisma.brand.update({
        where: { id: contract.brandId },
        data: {
          penaltyScore: { increment: 10 },
        },
      });
    }

    // Reopen the slot
    const auction = await prisma.auction.findUnique({
      where: { id: contract.auctionId },
      include: { slotInstance: true },
    });

    if (auction) {
      await prisma.slotInstance.update({
        where: { id: auction.slotInstanceId },
        data: { status: 'OPEN' },
      });
    }

    // 에스크로 환불 처리 (멱등성 보장)
    const escrow = await escrowService.getByContract(id);
    if (escrow && escrow.status === 'HELD') {
      await safeEscrowOperation(
        () => escrowService.refundToBrand(id, reason || '계약 취소'),
        'refundToBrand',
        id
      );
    }

    return prisma.contract.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  async updateStatus(id: string, status: ContractStatus) {
    return prisma.contract.update({
      where: { id },
      data: { status },
    });
  }

  async getByBrand(brandId: string) {
    return prisma.contract.findMany({
      where: { brandId },
      orderBy: { createdAt: 'desc' },
      include: {
        auction: {
          include: {
            slotInstance: {
              include: {
                event: true,
                athlete: true,
                slotTemplate: true,
              },
            },
          },
        },
        assets: true,
        verification: true,
        settlement: true,
      },
    });
  }

  async getByAthlete(athleteId: string) {
    return prisma.contract.findMany({
      where: { athleteId },
      orderBy: { createdAt: 'desc' },
      include: {
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
        brand: {
          select: {
            id: true,
            name: true,
            category: true,
          },
        },
        assets: true,
        verification: true,
        settlement: true,
      },
    });
  }

  // Check for expired asset deadlines
  async processExpiredDeadlines() {
    const expired = await prisma.contract.findMany({
      where: {
        status: 'ASSET_PENDING',
        assetDeadline: { lt: new Date() },
      },
    });

    for (const contract of expired) {
      await this.cancel(contract.id, 'ASSET_DEADLINE_MISSED');
    }

    return expired.length;
  }
}

export class CreativeAssetService {
  async upload(contractId: string, data: {
    fileUrl: string;
    fileName?: string;
    fileType?: string;
    fileSizeBytes?: number;
    notes?: string;
  }) {
    const contract = await prisma.contract.findUnique({ where: { id: contractId } });

    if (!contract) {
      throw new NotFoundError('Contract not found');
    }

    if (!['ASSET_PENDING', 'ACTIVE'].includes(contract.status)) {
      throw new BadRequestError('Contract is not accepting assets');
    }

    const asset = await prisma.creativeAsset.create({
      data: {
        contractId,
        ...data,
        status: 'SUBMITTED',
      },
    });

    // Update contract status
    await prisma.contract.update({
      where: { id: contractId },
      data: { status: 'ACTIVE' },
    });

    // 알림 발송: 에셋 제출
    try {
      await notificationService.notifyAssetSubmitted(contractId);
    } catch (e) {
      console.error('Failed to send asset submitted notification:', e);
    }

    return asset;
  }

  async review(assetId: string, status: AssetStatus, reviewedBy: string, notes?: string) {
    const asset = await prisma.creativeAsset.findUnique({
      where: { id: assetId },
      include: { contract: true },
    });

    if (!asset) {
      throw new NotFoundError('Asset not found');
    }

    const updatedAsset = await prisma.creativeAsset.update({
      where: { id: assetId },
      data: {
        status,
        reviewedBy,
        reviewedAt: new Date(),
        reviewNotes: notes,
      },
    });

    // Update contract status based on review
    if (status === 'APPROVED') {
      await prisma.contract.update({
        where: { id: asset.contractId },
        data: { status: 'ASSET_APPROVED' },
      });

      // 알림 발송: 에셋 승인
      try {
        await notificationService.notifyAssetApproved(asset.contractId);
      } catch (e) {
        console.error('Failed to send asset approved notification:', e);
      }
    } else if (status === 'REJECTED') {
      await prisma.contract.update({
        where: { id: asset.contractId },
        data: { status: 'ASSET_PENDING' },
      });

      // 알림 발송: 에셋 반려
      try {
        await notificationService.notifyAssetRejected(asset.contractId, notes);
      } catch (e) {
        console.error('Failed to send asset rejected notification:', e);
      }
    }

    return updatedAsset;
  }

  async getByContract(contractId: string) {
    return prisma.creativeAsset.findMany({
      where: { contractId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPendingReview() {
    return prisma.creativeAsset.findMany({
      where: { status: 'SUBMITTED' },
      include: {
        contract: {
          include: {
            brand: true,
            athlete: true,
            auction: {
              include: {
                slotInstance: {
                  include: {
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
  }
}

export class VerificationService {
  async submit(contractId: string, data: {
    photoUrls: string[];
    angles: string[];
  }) {
    const contract = await prisma.contract.findUnique({ where: { id: contractId } });

    if (!contract) {
      throw new NotFoundError('Contract not found');
    }

    if (contract.status !== 'ASSET_APPROVED') {
      throw new BadRequestError('Contract is not ready for verification');
    }

    // Check if verification already exists
    const existing = await prisma.verification.findUnique({
      where: { contractId },
    });

    if (existing) {
      // Update existing
      return prisma.verification.update({
        where: { id: existing.id },
        data: {
          photoUrls: data.photoUrls,
          angles: data.angles,
          status: 'SUBMITTED',
          verifiedAt: null,
          verifiedBy: null,
          rejectionReason: null,
        },
      });
    }

    const verification = await prisma.verification.create({
      data: {
        contractId,
        ...data,
        status: 'SUBMITTED',
      },
    });

    // Update contract status
    await prisma.contract.update({
      where: { id: contractId },
      data: { status: 'VERIFICATION_PENDING' },
    });

    // 알림 발송: 노출 인증 제출
    try {
      await notificationService.notifyVerificationSubmitted(contractId);
    } catch (e) {
      console.error('Failed to send verification submitted notification:', e);
    }

    return verification;
  }

  async review(
    verificationId: string,
    status: VerificationStatus,
    verifiedBy: string,
    rejectionReason?: string
  ) {
    const verification = await prisma.verification.findUnique({
      where: { id: verificationId },
      include: { contract: true },
    });

    if (!verification) {
      throw new NotFoundError('Verification not found');
    }

    const updated = await prisma.verification.update({
      where: { id: verificationId },
      data: {
        status,
        verifiedBy,
        verifiedAt: new Date(),
        rejectionReason,
      },
    });

    // Update contract status
    if (status === 'VERIFIED') {
      await prisma.contract.update({
        where: { id: verification.contractId },
        data: { status: 'VERIFIED' },
      });

      // 에스크로 릴리스 (선수에게 지급) - 멱등성 보장
      const releaseResult = await safeEscrowOperation(
        () => escrowService.releaseToAthlete(verification.contractId),
        'releaseToAthlete',
        verification.contractId
      );

      // 알림 발송: 정산 완료 (처음 릴리스된 경우에만)
      if (releaseResult.success && releaseResult.data && !releaseResult.alreadyProcessed) {
        try {
          await notificationService.notifySettlementCompleted(
            verification.contractId,
            toNumber(releaseResult.data.athletePayout)
          );
        } catch (e) {
          console.error('Failed to send settlement notification:', e);
        }
      }

      // 알림 발송: 노출 인증 승인
      try {
        await notificationService.notifyVerificationApproved(verification.contractId);
      } catch (e) {
        console.error('Failed to send verification approved notification:', e);
      }
    } else if (status === 'REJECTED') {
      await prisma.contract.update({
        where: { id: verification.contractId },
        data: { status: 'ASSET_APPROVED' },
      });

      // 알림 발송: 노출 인증 반려
      try {
        await notificationService.notifyVerificationRejected(verification.contractId, rejectionReason);
      } catch (e) {
        console.error('Failed to send verification rejected notification:', e);
      }
    }

    return updated;
  }

  async getByContract(contractId: string) {
    return prisma.verification.findUnique({
      where: { contractId },
    });
  }

  async getPendingReview() {
    return prisma.verification.findMany({
      where: { status: 'SUBMITTED' },
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
      orderBy: { createdAt: 'asc' },
    });
  }
}

export const contractService = new ContractService();
export const creativeAssetService = new CreativeAssetService();
export const verificationService = new VerificationService();
