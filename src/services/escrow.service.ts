import prisma from '../models/prisma';
import { NotFoundError, BadRequestError, ConflictError } from '../utils/errors';
import { EscrowStatus, LedgerTxType, WalletOwnerType } from '@prisma/client';
import { Prisma, PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const PLATFORM_FEE_RATE = new Decimal('0.1'); // 10% 플랫폼 수수료

// 멱등성 결과 타입
export interface IdempotentResult<T> {
  data: T;
  alreadyProcessed: boolean;  // true면 이미 처리된 것
}

// Decimal을 숫자로 변환하는 헬퍼
export function toNumber(val: Decimal | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  return val.toNumber();
}

// 숫자를 Decimal로 변환하는 헬퍼
export function toDecimal(val: number): Decimal {
  return new Decimal(val);
}

export class WalletService {
  /**
   * Get or create wallet for owner (트랜잭션 내에서 사용 가능)
   */
  async getOrCreateWallet(
    ownerType: WalletOwnerType,
    ownerId: string,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;

    // upsert로 원자적 생성/조회
    return client.wallet.upsert({
      where: { ownerType_ownerId: { ownerType, ownerId } },
      create: {
        ownerType,
        ownerId,
        balance: 0,
        frozenAmount: 0,
        version: 0,
      },
      update: {}, // 이미 존재하면 아무것도 안 함
    });
  }

  /**
   * Get wallet by ID
   */
  async getById(walletId: string) {
    const wallet = await prisma.wallet.findUnique({
      where: { id: walletId },
    });

    if (!wallet) {
      throw new NotFoundError('Wallet not found');
    }

    return wallet;
  }

  /**
   * Get wallet with transactions
   */
  async getWithTransactions(ownerType: WalletOwnerType, ownerId: string, limit = 50) {
    const wallet = await this.getOrCreateWallet(ownerType, ownerId);

    const transactions = await prisma.ledgerTx.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return { wallet, transactions };
  }

  /**
   * Add funds to wallet (deposit) - 멱등성 보장
   */
  async deposit(
    ownerType: WalletOwnerType,
    ownerId: string,
    amount: number,
    description?: string,
    refType?: string,
    refId?: string
  ): Promise<IdempotentResult<any>> {
    if (amount <= 0) {
      throw new BadRequestError('Amount must be positive');
    }

    return prisma.$transaction(async (tx) => {
      const wallet = await this.getOrCreateWallet(ownerType, ownerId, tx);

      // 중복 체크: 같은 ref로 이미 입금됐는지
      if (refType && refId) {
        const existing = await tx.ledgerTx.findUnique({
          where: {
            walletId_type_refType_refId: {
              walletId: wallet.id,
              type: 'DEPOSIT',
              refType,
              refId,
            },
          },
        });

        if (existing) {
          return { data: wallet, alreadyProcessed: true };
        }
      }

      const amountDecimal = toDecimal(amount);
      const newBalance = toDecimal(toNumber(wallet.balance)).add(amountDecimal);

      const updated = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: newBalance,
          version: { increment: 1 },
        },
      });

      await tx.ledgerTx.create({
        data: {
          walletId: wallet.id,
          type: 'DEPOSIT',
          amount: amountDecimal,
          balanceAfter: newBalance,
          status: 'COMPLETED',
          refType: refType || 'MANUAL',
          refId: refId || `deposit_${Date.now()}`,
          description,
        },
      });

      return { data: updated, alreadyProcessed: false };
    });
  }

  /**
   * Withdraw funds from wallet - 멱등성 보장
   */
  async withdraw(
    ownerType: WalletOwnerType,
    ownerId: string,
    amount: number,
    description?: string,
    refType?: string,
    refId?: string
  ): Promise<IdempotentResult<any>> {
    if (amount <= 0) {
      throw new BadRequestError('Amount must be positive');
    }

    return prisma.$transaction(async (tx) => {
      const wallet = await this.getOrCreateWallet(ownerType, ownerId, tx);

      // 중복 체크
      if (refType && refId) {
        const existing = await tx.ledgerTx.findUnique({
          where: {
            walletId_type_refType_refId: {
              walletId: wallet.id,
              type: 'WITHDRAW',
              refType,
              refId,
            },
          },
        });

        if (existing) {
          return { data: wallet, alreadyProcessed: true };
        }
      }

      const balance = toNumber(wallet.balance);
      const frozen = toNumber(wallet.frozenAmount);

      if (balance - frozen < amount) {
        throw new BadRequestError('Insufficient available balance');
      }

      const amountDecimal = toDecimal(amount);
      const newBalance = toDecimal(balance).sub(amountDecimal);

      const updated = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: newBalance,
          version: { increment: 1 },
        },
      });

      await tx.ledgerTx.create({
        data: {
          walletId: wallet.id,
          type: 'WITHDRAW',
          amount: amountDecimal.neg(), // 출금은 음수
          balanceAfter: newBalance,
          status: 'COMPLETED',
          refType: refType || 'MANUAL',
          refId: refId || `withdraw_${Date.now()}`,
          description,
        },
      });

      return { data: updated, alreadyProcessed: false };
    });
  }
}

export class EscrowService {
  private walletService = new WalletService();

  /**
   * Hold funds for contract (called when both parties sign)
   * 멱등성: 이미 에스크로가 있으면 그것을 반환
   */
  async holdFromContract(contractId: string): Promise<IdempotentResult<any>> {
    // 먼저 이미 존재하는지 체크 (빠른 경로)
    const existing = await prisma.escrow.findUnique({
      where: { contractId },
    });

    if (existing) {
      console.log(`[Escrow] Already held for contract ${contractId}`);
      return { data: existing, alreadyProcessed: true };
    }

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { brand: true, athlete: true },
    });

    if (!contract) {
      throw new NotFoundError('Contract not found');
    }

    // 계약 상태 검증 (양쪽 서명 완료 상태인지)
    if (!contract.brandSignedAt || !contract.athleteSignedAt) {
      throw new BadRequestError('Contract not fully signed');
    }

    const grossAmount = contract.priceFinal;
    const platformFee = Math.floor(grossAmount * toNumber(PLATFORM_FEE_RATE));
    const athletePayout = grossAmount - platformFee;

    return prisma.$transaction(async (tx) => {
      // 트랜잭션 내에서 다시 체크 (동시 호출 방어)
      const existingInTx = await tx.escrow.findUnique({
        where: { contractId },
      });

      if (existingInTx) {
        return { data: existingInTx, alreadyProcessed: true };
      }

      // 브랜드 지갑 가져오기
      const brandWallet = await this.walletService.getOrCreateWallet('BRAND', contract.brandId, tx);
      const currentBalance = toNumber(brandWallet.balance);

      // 데모용: 잔액 부족 시 자동 충전
      let walletToUse = brandWallet;
      if (currentBalance < grossAmount) {
        const chargeAmount = grossAmount - currentBalance + 1000000;
        const newBalance = toDecimal(currentBalance + chargeAmount);

        walletToUse = await tx.wallet.update({
          where: { id: brandWallet.id },
          data: {
            balance: newBalance,
            version: { increment: 1 },
          },
        });

        // 충전 트랜잭션 기록 (유니크 키로 중복 방지)
        try {
          await tx.ledgerTx.create({
            data: {
              walletId: brandWallet.id,
              type: 'DEPOSIT',
              amount: toDecimal(chargeAmount),
              balanceAfter: newBalance,
              status: 'COMPLETED',
              refType: 'AUTO_CHARGE',
              refId: contractId,
              description: '자동 충전 (데모)',
            },
          });
        } catch (e: any) {
          // 유니크 충돌이면 무시 (이미 충전됨)
          if (e.code !== 'P2002') throw e;
        }
      }

      // 지갑에서 차감 + 동결
      const walletBalance = toNumber(walletToUse.balance);
      if (walletBalance < grossAmount) {
        throw new BadRequestError('Insufficient brand wallet balance');
      }

      const newBalance = toDecimal(walletBalance - grossAmount);
      const newFrozen = toDecimal(toNumber(walletToUse.frozenAmount) + grossAmount);

      const updatedWallet = await tx.wallet.update({
        where: { id: walletToUse.id },
        data: {
          balance: newBalance,
          frozenAmount: newFrozen,
          version: { increment: 1 },
        },
      });

      // ESCROW_HOLD 트랜잭션 생성 (유니크 키로 중복 방지)
      await tx.ledgerTx.create({
        data: {
          walletId: walletToUse.id,
          type: 'ESCROW_HOLD',
          amount: toDecimal(-grossAmount),
          balanceAfter: newBalance,
          status: 'COMPLETED',
          refType: 'CONTRACT',
          refId: contractId,
          description: `계약 ${contractId} 에스크로 홀드`,
        },
      });

      // 에스크로 생성 (contractId unique로 중복 방지)
      const escrow = await tx.escrow.create({
        data: {
          contractId,
          brandId: contract.brandId,
          athleteId: contract.athleteId,
          grossAmount: toDecimal(grossAmount),
          platformFee: toDecimal(platformFee),
          platformFeeRate: PLATFORM_FEE_RATE,
          athletePayout: toDecimal(athletePayout),
          status: 'HELD',
        },
      });

      console.log(`[Escrow] Held ${grossAmount} for contract ${contractId}`);
      return { data: escrow, alreadyProcessed: false };
    });
  }

  /**
   * Release funds to athlete (called when verification is approved)
   * 멱등성: status=HELD 조건 업데이트로 중복 실행 방지
   */
  async releaseToAthlete(contractId: string): Promise<IdempotentResult<any>> {
    const escrow = await prisma.escrow.findUnique({
      where: { contractId },
    });

    if (!escrow) {
      throw new NotFoundError('Escrow not found');
    }

    // 이미 처리됨
    if (escrow.status === 'RELEASED') {
      console.log(`[Escrow] Already released for contract ${contractId}`);
      return { data: escrow, alreadyProcessed: true };
    }

    if (escrow.status !== 'HELD') {
      throw new BadRequestError(`Cannot release escrow with status: ${escrow.status}`);
    }

    return prisma.$transaction(async (tx) => {
      // 조건부 업데이트: status=HELD인 경우에만 RELEASED로 변경
      // 동시 호출 시 하나만 성공
      const updateResult = await tx.escrow.updateMany({
        where: {
          id: escrow.id,
          status: 'HELD', // 이 조건이 핵심!
        },
        data: {
          status: 'RELEASED',
          releasedAt: new Date(),
        },
      });

      // 업데이트된 행이 0이면 이미 처리됨
      if (updateResult.count === 0) {
        const current = await tx.escrow.findUnique({ where: { id: escrow.id } });
        console.log(`[Escrow] Release skipped - already ${current?.status}`);
        return { data: current, alreadyProcessed: true };
      }

      const grossAmount = toNumber(escrow.grossAmount);
      const athletePayout = toNumber(escrow.athletePayout);
      const platformFee = toNumber(escrow.platformFee);

      // 1. 브랜드 지갑 동결 해제
      const brandWallet = await tx.wallet.findFirst({
        where: { ownerType: 'BRAND', ownerId: escrow.brandId },
      });

      if (brandWallet) {
        await tx.wallet.update({
          where: { id: brandWallet.id },
          data: {
            frozenAmount: { decrement: grossAmount },
            version: { increment: 1 },
          },
        });
      }

      // 2. 선수 지갑에 입금
      const athleteWallet = await this.walletService.getOrCreateWallet('ATHLETE', escrow.athleteId, tx);
      const athleteNewBalance = toDecimal(toNumber(athleteWallet.balance) + athletePayout);

      await tx.wallet.update({
        where: { id: athleteWallet.id },
        data: {
          balance: athleteNewBalance,
          version: { increment: 1 },
        },
      });

      // 선수 입금 트랜잭션
      await tx.ledgerTx.create({
        data: {
          walletId: athleteWallet.id,
          type: 'ESCROW_RELEASE',
          amount: toDecimal(athletePayout),
          balanceAfter: athleteNewBalance,
          status: 'COMPLETED',
          refType: 'ESCROW',
          refId: escrow.id,
          description: `계약 ${contractId} 정산금 지급`,
        },
      });

      // 3. 플랫폼 지갑에 수수료 입금
      const platformWallet = await this.walletService.getOrCreateWallet('PLATFORM', 'PLATFORM', tx);
      const platformNewBalance = toDecimal(toNumber(platformWallet.balance) + platformFee);

      await tx.wallet.update({
        where: { id: platformWallet.id },
        data: {
          balance: platformNewBalance,
          version: { increment: 1 },
        },
      });

      // 플랫폼 수수료 트랜잭션
      await tx.ledgerTx.create({
        data: {
          walletId: platformWallet.id,
          type: 'PLATFORM_FEE',
          amount: toDecimal(platformFee),
          balanceAfter: platformNewBalance,
          status: 'COMPLETED',
          refType: 'ESCROW',
          refId: escrow.id,
          description: `계약 ${contractId} 플랫폼 수수료`,
        },
      });

      const updatedEscrow = await tx.escrow.findUnique({ where: { id: escrow.id } });
      console.log(`[Escrow] Released ${athletePayout} to athlete for contract ${contractId}`);
      return { data: updatedEscrow, alreadyProcessed: false };
    });
  }

  /**
   * Refund funds to brand (called when contract is cancelled)
   * 멱등성: status=HELD 조건 업데이트로 중복 실행 방지
   */
  async refundToBrand(contractId: string, reason?: string): Promise<IdempotentResult<any>> {
    const escrow = await prisma.escrow.findUnique({
      where: { contractId },
    });

    if (!escrow) {
      throw new NotFoundError('Escrow not found');
    }

    // 이미 처리됨
    if (escrow.status === 'REFUNDED') {
      console.log(`[Escrow] Already refunded for contract ${contractId}`);
      return { data: escrow, alreadyProcessed: true };
    }

    if (escrow.status !== 'HELD') {
      throw new BadRequestError(`Cannot refund escrow with status: ${escrow.status}`);
    }

    return prisma.$transaction(async (tx) => {
      // 조건부 업데이트: status=HELD인 경우에만 REFUNDED로 변경
      const updateResult = await tx.escrow.updateMany({
        where: {
          id: escrow.id,
          status: 'HELD',
        },
        data: {
          status: 'REFUNDED',
          refundedAt: new Date(),
        },
      });

      // 업데이트된 행이 0이면 이미 처리됨
      if (updateResult.count === 0) {
        const current = await tx.escrow.findUnique({ where: { id: escrow.id } });
        console.log(`[Escrow] Refund skipped - already ${current?.status}`);
        return { data: current, alreadyProcessed: true };
      }

      const grossAmount = toNumber(escrow.grossAmount);

      // 브랜드 지갑에 환불
      const brandWallet = await tx.wallet.findFirst({
        where: { ownerType: 'BRAND', ownerId: escrow.brandId },
      });

      if (!brandWallet) {
        throw new NotFoundError('Brand wallet not found');
      }

      const newBalance = toDecimal(toNumber(brandWallet.balance) + grossAmount);
      const newFrozen = toDecimal(Math.max(0, toNumber(brandWallet.frozenAmount) - grossAmount));

      await tx.wallet.update({
        where: { id: brandWallet.id },
        data: {
          balance: newBalance,
          frozenAmount: newFrozen,
          version: { increment: 1 },
        },
      });

      // 환불 트랜잭션
      await tx.ledgerTx.create({
        data: {
          walletId: brandWallet.id,
          type: 'ESCROW_REFUND',
          amount: toDecimal(grossAmount),
          balanceAfter: newBalance,
          status: 'COMPLETED',
          refType: 'ESCROW',
          refId: escrow.id,
          description: reason || `계약 ${contractId} 에스크로 환불`,
        },
      });

      const updatedEscrow = await tx.escrow.findUnique({ where: { id: escrow.id } });
      console.log(`[Escrow] Refunded ${grossAmount} to brand for contract ${contractId}`);
      return { data: updatedEscrow, alreadyProcessed: false };
    });
  }

  /**
   * Get escrow by contract ID
   */
  async getByContract(contractId: string) {
    return prisma.escrow.findUnique({
      where: { contractId },
    });
  }

  /**
   * Get all escrows with filters
   */
  async list(filters: {
    status?: EscrowStatus;
    brandId?: string;
    athleteId?: string;
    page?: number;
    limit?: number;
  }) {
    const { status, brandId, athleteId, page = 1, limit = 20 } = filters;

    const where: any = {};
    if (status) where.status = status;
    if (brandId) where.brandId = brandId;
    if (athleteId) where.athleteId = athleteId;

    const [escrows, total] = await Promise.all([
      prisma.escrow.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.escrow.count({ where }),
    ]);

    return { escrows, total };
  }

  /**
   * Process expired escrows (auto-refund after timeout)
   * 멱등성: refundToBrand 내부에서 처리됨
   */
  async processExpiredEscrows(timeoutDays = 30): Promise<number> {
    const cutoffDate = new Date(Date.now() - timeoutDays * 24 * 60 * 60 * 1000);

    const expiredEscrows = await prisma.escrow.findMany({
      where: {
        status: 'HELD',
        heldAt: { lt: cutoffDate },
      },
    });

    let refundedCount = 0;
    for (const escrow of expiredEscrows) {
      try {
        const contract = await prisma.contract.findUnique({
          where: { id: escrow.contractId },
        });

        // 진행 중이 아닌 계약만 환불
        if (contract && ['CANCELLED', 'PENDING_SIGNATURE', 'ASSET_PENDING'].includes(contract.status)) {
          const result = await this.refundToBrand(escrow.contractId, '에스크로 타임아웃 자동 환불');
          if (!result.alreadyProcessed) {
            refundedCount++;
          }
        }
      } catch (error) {
        console.error(`Failed to refund escrow ${escrow.id}:`, error);
      }
    }

    return refundedCount;
  }

  /**
   * Get escrow statistics
   */
  async getStats() {
    const [heldCount, heldAmount, releasedCount, releasedAmount, refundedCount, refundedAmount] = await Promise.all([
      prisma.escrow.count({ where: { status: 'HELD' } }),
      prisma.escrow.aggregate({ where: { status: 'HELD' }, _sum: { grossAmount: true } }),
      prisma.escrow.count({ where: { status: 'RELEASED' } }),
      prisma.escrow.aggregate({ where: { status: 'RELEASED' }, _sum: { grossAmount: true } }),
      prisma.escrow.count({ where: { status: 'REFUNDED' } }),
      prisma.escrow.aggregate({ where: { status: 'REFUNDED' }, _sum: { grossAmount: true } }),
    ]);

    return {
      held: { count: heldCount, amount: toNumber(heldAmount._sum.grossAmount) },
      released: { count: releasedCount, amount: toNumber(releasedAmount._sum.grossAmount) },
      refunded: { count: refundedCount, amount: toNumber(refundedAmount._sum.grossAmount) },
    };
  }
}

export const walletService = new WalletService();
export const escrowService = new EscrowService();
