/**
 * ★ Phase 9-3: Admin Operations Service
 * 운영자 강제 처리 비즈니스 로직
 */

import prisma from '../models/prisma';
import { NotFoundError, BadRequestError, ConflictError } from '../utils/errors';
import { Decimal } from '@prisma/client/runtime/library';
import { notificationService } from './notification.service';
import { auctionService } from './auction.service';

export class OpsService {
  /**
   * 예약 강제 해제 (Contract PENDING_SIGNATURE → CANCELLED)
   * - frozenAmount 해제
   * - Slot → OPEN
   * - LedgerTx 기록
   */
  async releaseReservation(
    contractId: string,
    adminId: string,
    reason: string
  ): Promise<{ alreadyProcessed: boolean; contract: any }> {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        auction: {
          include: {
            slotInstance: true,
            bids: {
              where: { isWinning: true },
              take: 1,
            },
          },
        },
        brand: {
          include: { user: true },
        },
        athlete: {
          include: { user: true },
        },
      },
    });

    if (!contract) {
      throw new NotFoundError('Contract not found');
    }

    // 이미 취소/완료된 경우
    if (contract.status === 'CANCELLED') {
      return { alreadyProcessed: true, contract };
    }

    // PENDING_SIGNATURE 상태만 해제 가능
    if (contract.status !== 'PENDING_SIGNATURE') {
      throw new BadRequestError(`Cannot release reservation with status: ${contract.status}`);
    }

    const isAuctionWin = contract.auction?.status === 'ENDED' && contract.auction?.winningBidId !== null;
    const winningBid = contract.auction?.bids?.[0];

    // 트랜잭션 처리
    const updatedContract = await prisma.$transaction(async (tx) => {
      // 1. Contract → CANCELLED
      const cancelled = await tx.contract.update({
        where: { id: contractId },
        data: {
          status: 'CANCELLED',
          terms: {
            ...(contract.terms as object || {}),
            cancelledAt: new Date().toISOString(),
            cancelledBy: 'ADMIN_OPS',
            cancelReason: reason,
          },
        },
      });

      // 2. Slot → OPEN
      if (contract.auction?.slotInstance) {
        await tx.slotInstance.update({
          where: { id: contract.auction.slotInstanceId },
          data: { status: 'OPEN' },
        });
      }

      // 3. frozenAmount 해제
      const brandWallet = await tx.wallet.findFirst({
        where: { ownerType: 'BRAND', ownerId: contract.brandId },
      });

      if (brandWallet) {
        let amountToRelease: Decimal | null = null;

        if (isAuctionWin && winningBid?.frozenAmount) {
          // 경매 낙찰: winningBid.frozenAmount 해제
          amountToRelease = new Decimal(winningBid.frozenAmount);

          await tx.bid.update({
            where: { id: winningBid.id },
            data: { frozenAmount: null },
          });
        } else if (!isAuctionWin && contract.priceFinal) {
          // Direct Buy: priceFinal 기준 해제
          amountToRelease = new Decimal(contract.priceFinal);
        }

        if (amountToRelease && amountToRelease.gt(0)) {
          // 동결 해제
          const newFrozen = new Decimal(brandWallet.frozenAmount).minus(amountToRelease);
          await tx.wallet.update({
            where: { id: brandWallet.id },
            data: {
              frozenAmount: newFrozen.lt(0) ? 0 : newFrozen,
              version: { increment: 1 },
            },
          });

          // LedgerTx 기록
          const ledgerType = isAuctionWin ? 'AUCTION_BID_RESERVE_RELEASE' : 'DIRECT_BUY_RESERVE_RELEASE';
          await tx.ledgerTx.create({
            data: {
              walletId: brandWallet.id,
              type: ledgerType,
              amount: amountToRelease.negated(),
              balanceAfter: brandWallet.balance,
              refType: 'CONTRACT',
              refId: contractId,
              description: `[Admin Ops] Reservation released: ${reason}`,
            },
          });
        }
      }

      return cancelled;
    });

    // 알림 발송
    if (contract.brand?.user?.id) {
      await notificationService.create({
        userId: contract.brand.user.id,
        type: 'CONTRACT_CREATED',
        title: '예약 해제 안내',
        message: `계약 예약이 운영자에 의해 해제되었습니다. 사유: ${reason}`,
        data: { contractId, action: 'RELEASE_RESERVATION' },
      });
    }

    if (contract.athlete?.user?.id) {
      await notificationService.create({
        userId: contract.athlete.user.id,
        type: 'CONTRACT_CREATED',
        title: '예약 해제 안내',
        message: `계약 예약이 운영자에 의해 해제되었습니다. 사유: ${reason}`,
        data: { contractId, action: 'RELEASE_RESERVATION' },
      });
    }

    return { alreadyProcessed: false, contract: updatedContract };
  }

  /**
   * 경매 강제 종료 (LIVE → ENDED/UNSOLD)
   * - 입찰자 있으면 Contract 생성
   * - 입찰자 없으면 UNSOLD
   */
  async forceCloseAuction(
    auctionId: string,
    adminId: string,
    reason: string
  ): Promise<{ alreadyProcessed: boolean; auction: any }> {
    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        slotInstance: {
          include: {
            event: true,
            athlete: { include: { user: true } },
          },
        },
        bids: {
          orderBy: { currentProxy: 'desc' },
          include: {
            brand: { include: { user: true } },
          },
        },
      },
    });

    if (!auction) {
      throw new NotFoundError('Auction not found');
    }

    // 이미 종료된 경우
    if (auction.status === 'ENDED' || auction.status === 'UNSOLD' || auction.status === 'CANCELLED') {
      return { alreadyProcessed: true, auction };
    }

    // LIVE 또는 SCHEDULED 상태만 강제 종료 가능
    if (auction.status !== 'LIVE' && auction.status !== 'SCHEDULED') {
      throw new BadRequestError(`Cannot force close auction with status: ${auction.status}`);
    }

    // 기존 endAuction 로직 재사용
    try {
      const result = await auctionService.endAuction(auctionId);

      // 강제 종료 이유 기록 (terms에 추가)
      await prisma.auction.update({
        where: { id: auctionId },
        data: {
          // Note: Auction 모델에 terms 필드가 없으므로 별도 처리 불필요
          // AdminActionLog에서 추적
        },
      });

      return { alreadyProcessed: false, auction: result };
    } catch (error: any) {
      // 이미 종료된 경우 (race condition)
      if (error.message?.includes('not live')) {
        const refreshed = await prisma.auction.findUnique({ where: { id: auctionId } });
        return { alreadyProcessed: true, auction: refreshed };
      }
      throw error;
    }
  }

  /**
   * Contract 조회 (Admin Ops 용)
   */
  async getContractForOps(contractId: string) {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        brand: { select: { id: true, name: true, category: true } },
        athlete: { select: { id: true, name: true } },
        auction: {
          include: {
            slotInstance: {
              include: {
                event: { select: { id: true, name: true } },
                slotTemplate: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    if (!contract) {
      throw new NotFoundError('Contract not found');
    }

    const now = new Date();
    const reservedUntil = contract.reservedUntil || new Date(0);
    const remainingMs = reservedUntil.getTime() - now.getTime();
    const remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000));

    return {
      ...contract,
      remainingSeconds,
      isExpired: remainingSeconds === 0 && contract.status === 'PENDING_SIGNATURE',
    };
  }

  /**
   * Auction 조회 (Admin Ops 용)
   */
  async getAuctionForOps(auctionId: string) {
    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        slotInstance: {
          include: {
            event: { select: { id: true, name: true } },
            athlete: { select: { id: true, name: true } },
            slotTemplate: { select: { id: true, name: true } },
          },
        },
        bids: {
          orderBy: { currentProxy: 'desc' },
          take: 5,
          include: {
            brand: { select: { id: true, name: true } },
          },
        },
        _count: { select: { bids: true } },
      },
    });

    if (!auction) {
      throw new NotFoundError('Auction not found');
    }

    const now = new Date();
    const remainingMs = auction.endAt.getTime() - now.getTime();
    const remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000));

    return {
      ...auction,
      bidCount: auction._count.bids,
      remainingSeconds,
    };
  }
}

export const opsService = new OpsService();
