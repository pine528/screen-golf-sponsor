import { Prisma, WithdrawalBatchStatus } from '@prisma/client';
import prisma from '../models/prisma';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { withdrawalService } from './withdrawal.service';
import { decryptAccountNumber } from '../utils/crypto';

// Decimal 변환 헬퍼
const toDecimal = (value: number | string | Prisma.Decimal): Prisma.Decimal => {
  return new Prisma.Decimal(value.toString());
};

const toNumber = (value: Prisma.Decimal | number | null): number => {
  if (value === null) return 0;
  if (typeof value === 'number') return value;
  return value.toNumber();
};

// CSV 수식 주입 방어
const sanitizeCsvField = (value: string | null | undefined): string => {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // 수식 주입 방어: =, +, -, @, 탭, 캐리지 리턴으로 시작하면 앞에 ' 추가
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
};

const escapeCsvField = (value: any): string => {
  const sanitized = sanitizeCsvField(value?.toString());
  if (sanitized.includes(',') || sanitized.includes('"') || sanitized.includes('\n')) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }
  return sanitized;
};

const toCsvRow = (fields: any[]): string => {
  return fields.map(escapeCsvField).join(',');
};

export interface BatchCreateResult {
  batch: any;
  included: string[];
  skipped: string[];
}

export interface BatchCompleteResult {
  batch: any;
  successCount: number;
  failedIds: string[];
  alreadyProcessedIds: string[];
}

export class WithdrawalBatchService {
  /**
   * 배치 생성: APPROVED 상태의 출금을 묶어서 배치 생성
   */
  async createBatch(
    withdrawalIds: string[],
    adminId: string,
    note?: string
  ): Promise<BatchCreateResult> {
    if (!withdrawalIds || withdrawalIds.length === 0) {
      throw new BadRequestError('출금 요청 ID를 1개 이상 선택해주세요');
    }

    // 1. 선택된 출금 요청 조회
    const withdrawals = await prisma.withdrawalRequest.findMany({
      where: {
        id: { in: withdrawalIds },
      },
    });

    // 2. APPROVED 상태 + 배치 미연결 건만 필터
    const included: string[] = [];
    const skipped: string[] = [];
    let totalAmount = toDecimal(0);

    for (const w of withdrawals) {
      if (w.status !== 'APPROVED') {
        skipped.push(w.id);
        continue;
      }
      if (w.batchId) {
        skipped.push(w.id);
        continue;
      }
      included.push(w.id);
      totalAmount = toDecimal(toNumber(totalAmount) + toNumber(w.amount));
    }

    if (included.length === 0) {
      throw new BadRequestError('포함할 수 있는 출금 요청이 없습니다. APPROVED 상태이면서 다른 배치에 포함되지 않은 건만 선택해주세요.');
    }

    // 3. 트랜잭션: 배치 생성 + 출금 연결
    const batch = await prisma.$transaction(async (tx) => {
      // 배치 생성
      const newBatch = await tx.withdrawalBatch.create({
        data: {
          status: 'CREATED',
          totalAmount,
          itemCount: included.length,
          createdByAdminId: adminId,
          note,
        },
      });

      // 출금 요청에 batchId 연결
      await tx.withdrawalRequest.updateMany({
        where: {
          id: { in: included },
          status: 'APPROVED',
          batchId: null,
        },
        data: {
          batchId: newBatch.id,
        },
      });

      return newBatch;
    });

    // 4. AuditLog 기록
    await prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'WITHDRAWAL_BATCH_CREATE',
        entityType: 'WITHDRAWAL_BATCH',
        entityId: batch.id,
        newValue: {
          itemCount: included.length,
          totalAmount: toNumber(totalAmount),
          includedIds: included,
          skippedIds: skipped,
        },
      },
    });

    return { batch, included, skipped };
  }

  /**
   * 배치 목록 조회
   */
  async list(options: {
    status?: WithdrawalBatchStatus;
    page?: number;
    pageSize?: number;
  } = {}) {
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.WithdrawalBatchWhereInput = {
      ...(options.status && { status: options.status }),
    };

    const [batches, total] = await Promise.all([
      prisma.withdrawalBatch.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          _count: {
            select: { withdrawals: true },
          },
        },
      }),
      prisma.withdrawalBatch.count({ where }),
    ]);

    return {
      batches,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * 배치 상세 조회
   */
  async getById(batchId: string) {
    const batch = await prisma.withdrawalBatch.findUnique({
      where: { id: batchId },
      include: {
        withdrawals: {
          include: {
            athlete: {
              include: { user: true },
            },
            wallet: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!batch) {
      throw new NotFoundError('배치를 찾을 수 없습니다');
    }

    return batch;
  }

  /**
   * 배치 CSV 내보내기 (은행 이체용)
   * ADMIN/FINANCE 권한 필요, 감사로그 기록
   */
  async exportCsv(batchId: string, adminId: string): Promise<string> {
    const batch = await this.getById(batchId);

    // 감사로그 기록 (CSV export with full account - 보안 이벤트)
    await prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'WITHDRAWAL_BATCH_EXPORT_CSV',
        entityType: 'WITHDRAWAL_BATCH',
        entityId: batchId,
        newValue: {
          itemCount: batch.withdrawals.length,
          exportedAt: new Date().toISOString(),
          includesFullAccount: true,
        },
      },
    });

    // CSV 헤더 (원본 계좌번호 포함)
    const headers = ['예금주', '은행명', '계좌번호', '금액', '요청ID', '선수명'];

    // CSV 행 (암호화된 계좌 복호화)
    const rows = batch.withdrawals.map((w: any) => {
      // 암호화된 계좌가 있으면 복호화, 없으면 마스킹 출력
      let accountNumber = w.bankAccountMasked;

      if (w.bankAccountEncrypted && w.bankAccountIv && w.bankAccountTag) {
        try {
          accountNumber = decryptAccountNumber(
            w.bankAccountEncrypted,
            w.bankAccountIv,
            w.bankAccountTag
          );
        } catch (error: any) {
          // 복호화 실패 시 마스킹 유지 (에러 로그에 계좌번호 노출 금지)
          console.error(`[ExportCsv] 복호화 실패 (ID: ${w.id}): ${error.message}`);
        }
      }

      return toCsvRow([
        w.accountHolder,
        w.bankName,
        accountNumber,
        toNumber(w.amount),
        w.id,
        w.athlete?.name || '',
      ]);
    });

    // UTF-8 BOM + CSV 내용
    const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n');

    // exportedAt 갱신
    await prisma.withdrawalBatch.update({
      where: { id: batchId },
      data: {
        status: batch.status === 'CREATED' ? 'EXPORTED' : batch.status,
        exportedAt: new Date(),
      },
    });

    return csv;
  }

  /**
   * 배치 일괄 지급 완료
   */
  async completeBatch(
    batchId: string,
    adminId: string,
    proofUrl?: string,
    reason?: string
  ): Promise<BatchCompleteResult> {
    const batch = await this.getById(batchId);

    // 상태 검증: CREATED 또는 EXPORTED만 완료 가능
    if (batch.status !== 'CREATED' && batch.status !== 'EXPORTED') {
      if (batch.status === 'COMPLETED') {
        return {
          batch,
          successCount: 0,
          failedIds: [],
          alreadyProcessedIds: batch.withdrawals.map((w: any) => w.id),
        };
      }
      throw new BadRequestError(`상태가 '${batch.status}'인 배치는 완료 처리할 수 없습니다`);
    }

    const successIds: string[] = [];
    const failedIds: string[] = [];
    const alreadyProcessedIds: string[] = [];

    // 각 출금에 대해 adminMarkPaid 호출
    for (const withdrawal of batch.withdrawals) {
      try {
        const result = await withdrawalService.adminMarkPaid(
          withdrawal.id,
          adminId,
          `BATCH:${batchId}`,
          reason,
          proofUrl
        );

        if (result.alreadyProcessed) {
          alreadyProcessedIds.push(withdrawal.id);
        } else {
          successIds.push(withdrawal.id);
        }
      } catch (error: any) {
        console.error(`[WithdrawalBatch] Failed to mark paid: ${withdrawal.id}`, error.message);
        failedIds.push(withdrawal.id);
      }
    }

    // 배치 상태 조건부 업데이트 (멱등성 보장)
    const updateResult = await prisma.withdrawalBatch.updateMany({
      where: {
        id: batchId,
        status: { in: ['CREATED', 'EXPORTED'] },
      },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        proofUrl,
      },
    });

    // 조건부 업데이트 실패 시 (이미 COMPLETED/CANCELED 등) 현재 상태 조회
    const updatedBatch = await this.getById(batchId);

    // 업데이트되지 않았다면 메타데이터가 이미 설정된 상태
    if (updateResult.count === 0) {
      console.log(`[WithdrawalBatch] Batch ${batchId} already in final state, skipping metadata update`);
    }

    // AuditLog 기록
    await prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'WITHDRAWAL_BATCH_COMPLETE',
        entityType: 'WITHDRAWAL_BATCH',
        entityId: batchId,
        newValue: {
          successCount: successIds.length,
          failedCount: failedIds.length,
          alreadyProcessedCount: alreadyProcessedIds.length,
          proofUrl,
          reason,
        },
      },
    });

    return {
      batch: updatedBatch,
      successCount: successIds.length,
      failedIds,
      alreadyProcessedIds,
    };
  }

  /**
   * 배치 취소
   */
  async cancelBatch(batchId: string, adminId: string, reason: string): Promise<any> {
    const batch = await this.getById(batchId);

    if (batch.status === 'COMPLETED') {
      throw new BadRequestError('완료된 배치는 취소할 수 없습니다');
    }

    if (batch.status === 'CANCELED') {
      return batch;
    }

    // 트랜잭션: 배치 취소 + 출금 연결 해제
    const result = await prisma.$transaction(async (tx) => {
      // 출금 연결 해제
      await tx.withdrawalRequest.updateMany({
        where: { batchId },
        data: { batchId: null },
      });

      // 배치 취소
      const canceled = await tx.withdrawalBatch.update({
        where: { id: batchId },
        data: {
          status: 'CANCELED',
          note: batch.note ? `${batch.note}\n[취소] ${reason}` : `[취소] ${reason}`,
        },
      });

      return canceled;
    });

    // AuditLog 기록
    await prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'WITHDRAWAL_BATCH_CANCEL',
        entityType: 'WITHDRAWAL_BATCH',
        entityId: batchId,
        newValue: { reason },
      },
    });

    return result;
  }
}

export const withdrawalBatchService = new WithdrawalBatchService();
