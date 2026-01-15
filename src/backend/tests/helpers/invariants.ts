/**
 * 돈 불변식(Invariants) 검증 헬퍼
 * 에스크로/원장 시스템의 무결성을 검증하는 함수들
 */

import prisma from '../../src/models/prisma';
import { Decimal } from '@prisma/client/runtime/library';

export interface WalletSnapshot {
  id: string;
  ownerType: string;
  ownerId: string;
  balance: Decimal;
  frozenAmount: Decimal;
  version: number;
}

export interface InvariantResult {
  valid: boolean;
  errors: string[];
}

/**
 * 지갑 조회 헬퍼
 */
export async function fetchWallet(ownerType: string, ownerId: string): Promise<WalletSnapshot | null> {
  const wallet = await prisma.wallet.findUnique({
    where: {
      ownerType_ownerId: { ownerType, ownerId },
    },
  });
  return wallet as WalletSnapshot | null;
}

/**
 * 원장(LedgerTx) 합계 조회
 */
export async function sumLedger(
  walletId: string,
  type?: 'CREDIT' | 'DEBIT',
  refType?: string,
  refId?: string
): Promise<Decimal> {
  const where: any = { walletId };
  if (type) where.type = type;
  if (refType) where.refType = refType;
  if (refId) where.refId = refId;

  const result = await prisma.ledgerTx.aggregate({
    where,
    _sum: { amount: true },
  });

  return result._sum.amount || new Decimal(0);
}

/**
 * 특정 ref에 대한 LedgerTx 개수 조회
 */
export async function countLedgerTx(
  walletId: string,
  type: 'CREDIT' | 'DEBIT',
  refType: string,
  refId: string
): Promise<number> {
  return prisma.ledgerTx.count({
    where: { walletId, type, refType, refId },
  });
}

/**
 * 계약에 연결된 에스크로 개수 조회
 */
export async function countEscrowsForContract(contractId: string): Promise<number> {
  return prisma.escrow.count({
    where: { contractId },
  });
}

/**
 * 불변식 A: 지갑 잔액과 동결금액은 음수가 될 수 없다
 */
export async function assertNonNegativeBalances(): Promise<InvariantResult> {
  const errors: string[] = [];

  const wallets = await prisma.wallet.findMany();
  for (const wallet of wallets) {
    if (wallet.balance.lessThan(0)) {
      errors.push(`Wallet ${wallet.id} has negative balance: ${wallet.balance}`);
    }
    if (wallet.frozenAmount.lessThan(0)) {
      errors.push(`Wallet ${wallet.id} has negative frozenAmount: ${wallet.frozenAmount}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 불변식 B: HELD 에스크로의 grossAmount 합 = 해당 브랜드의 frozenAmount
 */
export async function assertHeldEscrowMatchesFrozen(): Promise<InvariantResult> {
  const errors: string[] = [];

  // 브랜드별 HELD 에스크로 합계
  const heldEscrows = await prisma.escrow.groupBy({
    by: ['brandId'],
    where: { status: 'HELD' },
    _sum: { grossAmount: true },
  });

  for (const group of heldEscrows) {
    const brandWallet = await fetchWallet('BRAND', group.brandId);
    if (!brandWallet) {
      errors.push(`Brand ${group.brandId} has HELD escrow but no wallet`);
      continue;
    }

    const expectedFrozen = group._sum.grossAmount || new Decimal(0);
    if (!brandWallet.frozenAmount.equals(expectedFrozen)) {
      errors.push(
        `Brand ${group.brandId} frozenAmount mismatch: ` +
        `wallet=${brandWallet.frozenAmount}, escrows=${expectedFrozen}`
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 불변식 C: RELEASED 에스크로는 athlete/platform 지갑에 정확히 분배
 */
export async function assertReleasedEscrowDistributed(contractId: string): Promise<InvariantResult> {
  const errors: string[] = [];

  const escrow = await prisma.escrow.findUnique({
    where: { contractId },
    include: { contract: true },
  });

  if (!escrow || escrow.status !== 'RELEASED') {
    return { valid: true, errors: [] }; // 검증 대상 아님
  }

  // 선수 지갑에 athletePayout CREDIT이 있어야 함
  const athleteWallet = await fetchWallet('ATHLETE', escrow.contract.athleteId);
  if (!athleteWallet) {
    errors.push(`Athlete ${escrow.contract.athleteId} wallet not found after RELEASED`);
  } else {
    const athleteCredit = await sumLedger(athleteWallet.id, 'CREDIT', 'ESCROW_RELEASE', escrow.id);
    if (!athleteCredit.equals(escrow.athletePayout)) {
      errors.push(
        `Athlete credit mismatch: ledger=${athleteCredit}, expected=${escrow.athletePayout}`
      );
    }
  }

  // 플랫폼 지갑에 platformFee CREDIT이 있어야 함
  const platformWallet = await fetchWallet('PLATFORM', 'SYSTEM');
  if (!platformWallet) {
    errors.push(`Platform wallet not found after RELEASED`);
  } else {
    const platformCredit = await sumLedger(platformWallet.id, 'CREDIT', 'ESCROW_FEE', escrow.id);
    if (!platformCredit.equals(escrow.platformFee)) {
      errors.push(
        `Platform credit mismatch: ledger=${platformCredit}, expected=${escrow.platformFee}`
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 불변식 D: 같은 (walletId, type, refType, refId) LedgerTx는 1개만 존재
 */
export async function assertUniqueLedgerTx(): Promise<InvariantResult> {
  const errors: string[] = [];

  // 중복 체크 쿼리
  const duplicates = await prisma.$queryRaw<Array<{
    walletId: string;
    type: string;
    refType: string;
    refId: string;
    cnt: bigint;
  }>>`
    SELECT "wallet_id" as "walletId", "type", "ref_type" as "refType", "ref_id" as "refId", COUNT(*) as cnt
    FROM "LedgerTx"
    GROUP BY "wallet_id", "type", "ref_type", "ref_id"
    HAVING COUNT(*) > 1
  `;

  for (const dup of duplicates) {
    errors.push(
      `Duplicate LedgerTx: wallet=${dup.walletId}, type=${dup.type}, ` +
      `refType=${dup.refType}, refId=${dup.refId}, count=${dup.cnt}`
    );
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 불변식 E: 계약당 에스크로는 1개만 존재
 */
export async function assertUniqueEscrowPerContract(): Promise<InvariantResult> {
  const errors: string[] = [];

  const duplicates = await prisma.$queryRaw<Array<{
    contractId: string;
    cnt: bigint;
  }>>`
    SELECT "contract_id" as "contractId", COUNT(*) as cnt
    FROM "Escrow"
    GROUP BY "contract_id"
    HAVING COUNT(*) > 1
  `;

  for (const dup of duplicates) {
    errors.push(`Duplicate Escrow for contract ${dup.contractId}: count=${dup.cnt}`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 모든 불변식을 한 번에 검증
 */
export async function assertAllInvariants(contractId?: string): Promise<InvariantResult> {
  const allErrors: string[] = [];

  const checks = [
    assertNonNegativeBalances(),
    assertUniqueLedgerTx(),
    assertUniqueEscrowPerContract(),
  ];

  // HELD 상태 에스크로가 있는 경우에만 frozen 체크
  const heldCount = await prisma.escrow.count({ where: { status: 'HELD' } });
  if (heldCount > 0) {
    checks.push(assertHeldEscrowMatchesFrozen());
  }

  // 특정 계약의 RELEASED 검증
  if (contractId) {
    checks.push(assertReleasedEscrowDistributed(contractId));
  }

  const results = await Promise.all(checks);
  for (const result of results) {
    allErrors.push(...result.errors);
  }

  return { valid: allErrors.length === 0, errors: allErrors };
}

/**
 * Jest expect와 함께 사용하는 assertion 래퍼
 */
export async function expectInvariantsValid(contractId?: string): Promise<void> {
  const result = await assertAllInvariants(contractId);
  if (!result.valid) {
    throw new Error(`Invariant violations:\n${result.errors.join('\n')}`);
  }
}
