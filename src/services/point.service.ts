import { Prisma, PointTxReason } from '@prisma/client';
import prisma from '../models/prisma';
import { BadRequestError, ConflictError } from '../utils/errors';

export class PointService {
  /**
   * 사용자의 포인트 지갑을 가져오거나 생성합니다
   */
  async getOrCreateWallet(userId: string) {
    let wallet = await prisma.pointWallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      wallet = await prisma.pointWallet.create({
        data: {
          userId,
          balance: 0,
          version: 0,
        },
      });
    }

    return wallet;
  }

  /**
   * 포인트 조정 (적립 또는 차감)
   * 멱등성 보장: 동일한 refType/refId로 중복 호출 시 한 번만 처리됩니다
   *
   * @param userId 사용자 ID
   * @param delta 변경량 (양수: 적립, 음수: 차감)
   * @param reason 사유 (ADMIN_GRANT, VOTE_ENTRY_FEE 등)
   * @param refType 참조 타입 (예: 'VOTE_EVENT', 'ADMIN_GRANT')
   * @param refId 참조 ID (예: voteEventId, grantId)
   * @param description 설명 (선택)
   * @returns { success: boolean, alreadyProcessed: boolean, tx?: PointLedgerTx }
   */
  async adjustPoints(
    userId: string,
    delta: number | Prisma.Decimal,
    reason: PointTxReason,
    refType: string,
    refId: string,
    description?: string
  ) {
    const deltaDecimal = new Prisma.Decimal(delta.toString());

    try {
      const result = await prisma.$transaction(async (tx) => {
        // 1. 지갑 조회 또는 생성
        let wallet = await tx.pointWallet.findUnique({
          where: { userId },
        });

        if (!wallet) {
          wallet = await tx.pointWallet.create({
            data: {
              userId,
              balance: 0,
              version: 0,
            },
          });
        }

        // 2. 새로운 잔액 계산
        const newBalance = new Prisma.Decimal(wallet.balance.toString()).plus(deltaDecimal);

        // 3. 잔액 음수 방지
        if (newBalance.lessThan(0)) {
          throw new BadRequestError('포인트 잔액이 부족합니다');
        }

        // 4. 낙관적 락으로 지갑 업데이트
        const updatedWallet = await tx.pointWallet.updateMany({
          where: {
            userId,
            version: wallet.version,
          },
          data: {
            balance: newBalance,
            version: { increment: 1 },
          },
        });

        // 버전 충돌 (동시성 문제)
        if (updatedWallet.count === 0) {
          throw new ConflictError('포인트 업데이트 중 충돌이 발생했습니다. 다시 시도해주세요');
        }

        // 5. 원장 기록 (멱등성 보장 - unique constraint)
        const ledgerTx = await tx.pointLedgerTx.create({
          data: {
            userId,
            delta: deltaDecimal,
            balanceAfter: newBalance,
            reason,
            refType,
            refId,
            description,
          },
        });

        return { success: true, alreadyProcessed: false, tx: ledgerTx };
      });

      return result;
    } catch (error: any) {
      // P2002: Unique constraint violation (멱등성 - 이미 처리된 트랜잭션)
      if (error.code === 'P2002' && error.meta?.target?.includes('unique_point_tx')) {
        return { success: true, alreadyProcessed: true };
      }

      throw error;
    }
  }

  /**
   * 사용자 포인트 잔액 조회
   */
  async getBalance(userId: string) {
    const wallet = await this.getOrCreateWallet(userId);
    return {
      balance: wallet.balance,
      updatedAt: wallet.updatedAt,
    };
  }

  /**
   * 포인트 내역 조회
   */
  async getHistory(
    userId: string,
    options: {
      page?: number;
      pageSize?: number;
      reason?: PointTxReason;
    } = {}
  ) {
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.PointLedgerTxWhereInput = {
      userId,
      ...(options.reason && { reason: options.reason }),
    };

    const [transactions, total] = await Promise.all([
      prisma.pointLedgerTx.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.pointLedgerTx.count({ where }),
    ]);

    return {
      transactions,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * 관리자: 포인트 지급
   */
  async adminGrant(
    userId: string,
    amount: number,
    grantId: string,
    reasonText?: string
  ) {
    if (amount <= 0) {
      throw new BadRequestError('지급 금액은 0보다 커야 합니다');
    }

    return this.adjustPoints(
      userId,
      amount,
      'ADMIN_GRANT',
      'ADMIN_GRANT',
      grantId,
      reasonText || `관리자 포인트 지급: ${amount}P`
    );
  }

  /**
   * 투표 참여 수수료 차감
   */
  async deductVoteEntryFee(userId: string, voteEventId: string, fee: number) {
    if (fee <= 0) {
      throw new BadRequestError('참여 수수료는 0보다 커야 합니다');
    }

    return this.adjustPoints(
      userId,
      -fee,
      'VOTE_ENTRY_FEE',
      'VOTE_EVENT',
      voteEventId,
      `투표 참여 수수료: ${fee}P`
    );
  }

  /**
   * 투표 당첨 보상 지급
   */
  async payoutVoteWin(userId: string, voteEventId: string, amount: number) {
    if (amount <= 0) {
      throw new BadRequestError('보상 금액은 0보다 커야 합니다');
    }

    return this.adjustPoints(
      userId,
      amount,
      'VOTE_WIN_PAYOUT',
      'VOTE_EVENT',
      voteEventId,
      `투표 당첨 보상: ${amount}P`
    );
  }

  /**
   * 투표 생성 수수료 차감
   */
  async deductVoteCreateFee(userId: string, voteEventId: string, fee: number) {
    if (fee <= 0) {
      throw new BadRequestError('생성 수수료는 0보다 커야 합니다');
    }

    return this.adjustPoints(
      userId,
      -fee,
      'VOTE_CREATE_FEE',
      'VOTE_EVENT',
      voteEventId,
      `투표 생성 수수료: ${fee}P`
    );
  }

  /**
   * 포인트 교환 (상품 구매 등)
   */
  async redeemPoints(userId: string, redemptionId: string, amount: number, itemName?: string) {
    if (amount <= 0) {
      throw new BadRequestError('교환 금액은 0보다 커야 합니다');
    }

    return this.adjustPoints(
      userId,
      -amount,
      'REDEEM_GOODS',
      'REDEMPTION',
      redemptionId,
      itemName ? `상품 교환: ${itemName} (${amount}P)` : `포인트 교환: ${amount}P`
    );
  }
}

export const pointService = new PointService();
