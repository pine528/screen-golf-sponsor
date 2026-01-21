import { Prisma, LedgerTxType, WalletOwnerType, DocumentExportType } from '@prisma/client';
import PDFDocument from 'pdfkit';
import prisma from '../models/prisma';
import { NotFoundError, BadRequestError } from '../utils/errors';

// Decimal 변환 헬퍼
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

// 금액 포맷
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('ko-KR').format(amount);
};

// 날짜 포맷
const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

const formatDateTime = (date: Date): string => {
  return date.toISOString().replace('T', ' ').substring(0, 19);
};

// LedgerTxType을 한글로 변환
const txTypeToKorean = (type: LedgerTxType): string => {
  const map: Record<LedgerTxType, string> = {
    DEPOSIT: '입금',
    WITHDRAW: '출금',
    ESCROW_HOLD: '에스크로 홀드',
    ESCROW_RELEASE: '에스크로 릴리즈',
    ESCROW_REFUND: '에스크로 환불',
    PLATFORM_FEE: '플랫폼 수수료',
    ADJUSTMENT: '수동 조정',
    DIRECT_BUY_RESERVE: '즉시구매 예약',
    DIRECT_BUY_RESERVE_RELEASE: '즉시구매 예약 해제',
    AUCTION_BID_RESERVE: '입찰 예약',
    AUCTION_BID_RESERVE_RELEASE: '입찰 예약 해제',
    TOPUP_DEPOSIT: '충전',
    TOPUP_REFUND: '충전 환불',
  };
  return map[type] || type;
};

// 요약 타입
export interface StatementSummary {
  fromDate: Date;
  toDate: Date;
  totalTopup: number;
  totalRefund: number;
  totalEscrowHold: number;
  totalEscrowRelease: number;
  totalEscrowRefund: number;
  totalPlatformFee: number;
  netSpend: number;
  transactionCount: number;
}

// 거래 항목 타입
export interface StatementItem {
  id: string;
  date: Date;
  type: LedgerTxType;
  typeKorean: string;
  amount: number;
  balanceAfter: number;
  description: string | null;
  refType: string | null;
  refId: string | null;
}

export interface StatementItemsResult {
  items: StatementItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export class StatementsService {
  /**
   * 브랜드의 Wallet 조회
   */
  private async getBrandWallet(brandId: string) {
    const wallet = await prisma.wallet.findUnique({
      where: {
        ownerType_ownerId: {
          ownerType: WalletOwnerType.BRAND,
          ownerId: brandId,
        },
      },
    });

    if (!wallet) {
      // 지갑이 없으면 빈 결과 반환을 위해 null 반환
      return null;
    }

    return wallet;
  }

  /**
   * 기간별 요약 조회
   */
  async getSummary(brandId: string, fromDate: Date, toDate: Date): Promise<StatementSummary> {
    const wallet = await this.getBrandWallet(brandId);

    if (!wallet) {
      return {
        fromDate,
        toDate,
        totalTopup: 0,
        totalRefund: 0,
        totalEscrowHold: 0,
        totalEscrowRelease: 0,
        totalEscrowRefund: 0,
        totalPlatformFee: 0,
        netSpend: 0,
        transactionCount: 0,
      };
    }

    // 기간 내 거래 집계
    const aggregations = await prisma.ledgerTx.groupBy({
      by: ['type'],
      where: {
        walletId: wallet.id,
        createdAt: {
          gte: fromDate,
          lte: toDate,
        },
      },
      _sum: {
        amount: true,
      },
      _count: true,
    });

    // 초기화
    let totalTopup = 0;
    let totalRefund = 0;
    let totalEscrowHold = 0;
    let totalEscrowRelease = 0;
    let totalEscrowRefund = 0;
    let totalPlatformFee = 0;
    let transactionCount = 0;

    for (const agg of aggregations) {
      const sum = toNumber(agg._sum.amount);
      transactionCount += agg._count;

      switch (agg.type) {
        case 'TOPUP_DEPOSIT':
          totalTopup = sum;
          break;
        case 'TOPUP_REFUND':
          totalRefund = Math.abs(sum);
          break;
        case 'ESCROW_HOLD':
          totalEscrowHold = Math.abs(sum);
          break;
        case 'ESCROW_RELEASE':
          totalEscrowRelease = Math.abs(sum);
          break;
        case 'ESCROW_REFUND':
          totalEscrowRefund = sum;
          break;
        case 'PLATFORM_FEE':
          totalPlatformFee = Math.abs(sum);
          break;
      }
    }

    // 순 지출 = 에스크로 홀드 - 에스크로 환불 (실제로 브랜드가 지출한 금액)
    const netSpend = totalEscrowHold - totalEscrowRefund;

    return {
      fromDate,
      toDate,
      totalTopup,
      totalRefund,
      totalEscrowHold,
      totalEscrowRelease,
      totalEscrowRefund,
      totalPlatformFee,
      netSpend,
      transactionCount,
    };
  }

  /**
   * 거래 내역 조회 (페이지네이션)
   */
  async getItems(
    brandId: string,
    fromDate: Date,
    toDate: Date,
    page: number = 1,
    pageSize: number = 20
  ): Promise<StatementItemsResult> {
    const wallet = await this.getBrandWallet(brandId);

    if (!wallet) {
      return {
        items: [],
        pagination: {
          page,
          pageSize,
          total: 0,
          totalPages: 0,
        },
      };
    }

    const where: Prisma.LedgerTxWhereInput = {
      walletId: wallet.id,
      createdAt: {
        gte: fromDate,
        lte: toDate,
      },
    };

    const [transactions, total] = await Promise.all([
      prisma.ledgerTx.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.ledgerTx.count({ where }),
    ]);

    const items: StatementItem[] = transactions.map((tx) => ({
      id: tx.id,
      date: tx.createdAt,
      type: tx.type,
      typeKorean: txTypeToKorean(tx.type),
      amount: toNumber(tx.amount),
      balanceAfter: toNumber(tx.balanceAfter),
      description: tx.description,
      refType: tx.refType,
      refId: tx.refId,
    }));

    return {
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * CSV 내보내기
   */
  async exportCsv(
    brandId: string,
    userId: string,
    fromDate: Date,
    toDate: Date,
    ipAddress?: string
  ): Promise<string> {
    const wallet = await this.getBrandWallet(brandId);

    if (!wallet) {
      throw new NotFoundError('지갑을 찾을 수 없습니다. 충전 내역이 없습니다.');
    }

    // 전체 거래 조회 (페이지네이션 없이)
    const transactions = await prisma.ledgerTx.findMany({
      where: {
        walletId: wallet.id,
        createdAt: {
          gte: fromDate,
          lte: toDate,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 내보내기 로그 기록
    await prisma.documentExportLog.create({
      data: {
        userId,
        brandId,
        exportType: DocumentExportType.STATEMENT_CSV,
        fromDate,
        toDate,
        itemCount: transactions.length,
        ipAddress,
      },
    });

    // CSV 헤더
    const headers = ['날짜', '시간', '유형', '금액', '잔액', '설명', '참조유형', '참조ID'];

    // CSV 행 생성
    const rows = transactions.map((tx) =>
      toCsvRow([
        formatDate(tx.createdAt),
        formatDateTime(tx.createdAt),
        txTypeToKorean(tx.type),
        toNumber(tx.amount),
        toNumber(tx.balanceAfter),
        tx.description || '',
        tx.refType || '',
        tx.refId || '',
      ])
    );

    // UTF-8 BOM + CSV
    return '\uFEFF' + [headers.join(','), ...rows].join('\n');
  }

  /**
   * PDF 내보내기
   */
  async exportPdf(
    brandId: string,
    userId: string,
    fromDate: Date,
    toDate: Date,
    ipAddress?: string
  ): Promise<Buffer> {
    const wallet = await this.getBrandWallet(brandId);

    if (!wallet) {
      throw new NotFoundError('지갑을 찾을 수 없습니다. 충전 내역이 없습니다.');
    }

    // 브랜드 정보 조회
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      include: {
        billingProfile: true,
      },
    });

    // 요약 조회
    const summary = await this.getSummary(brandId, fromDate, toDate);

    // 전체 거래 조회
    const transactions = await prisma.ledgerTx.findMany({
      where: {
        walletId: wallet.id,
        createdAt: {
          gte: fromDate,
          lte: toDate,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 내보내기 로그 기록
    await prisma.documentExportLog.create({
      data: {
        userId,
        brandId,
        exportType: DocumentExportType.STATEMENT_PDF,
        fromDate,
        toDate,
        itemCount: transactions.length,
        ipAddress,
      },
    });

    // PDF 생성
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({ margin: 50, size: 'A4' });

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // 제목
      doc.fontSize(20).text('거래 명세서 (Statement)', { align: 'center' });
      doc.moveDown();

      // 기간
      doc.fontSize(12).text(`기간: ${formatDate(fromDate)} ~ ${formatDate(toDate)}`, { align: 'center' });
      doc.moveDown();

      // 브랜드 정보
      if (brand) {
        doc.fontSize(10).text(`브랜드: ${brand.name}`);
        if (brand.billingProfile) {
          doc.text(`사업자번호: ${brand.billingProfile.businessNumber}`);
          doc.text(`상호: ${brand.billingProfile.businessName}`);
        }
      }
      doc.moveDown();

      // 요약 섹션
      doc.fontSize(14).text('요약', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10);
      doc.text(`총 충전: ${formatCurrency(summary.totalTopup)} 원`);
      doc.text(`총 환불: ${formatCurrency(summary.totalRefund)} 원`);
      doc.text(`에스크로 홀드: ${formatCurrency(summary.totalEscrowHold)} 원`);
      doc.text(`에스크로 릴리즈: ${formatCurrency(summary.totalEscrowRelease)} 원`);
      doc.text(`에스크로 환불: ${formatCurrency(summary.totalEscrowRefund)} 원`);
      doc.text(`플랫폼 수수료: ${formatCurrency(summary.totalPlatformFee)} 원`);
      doc.text(`순 지출: ${formatCurrency(summary.netSpend)} 원`);
      doc.text(`총 거래 건수: ${summary.transactionCount} 건`);
      doc.moveDown();

      // 거래 내역 섹션
      doc.fontSize(14).text('거래 내역', { underline: true });
      doc.moveDown(0.5);

      // 테이블 헤더
      const tableTop = doc.y;
      const colWidths = [70, 80, 80, 80, 180];
      const headers = ['날짜', '유형', '금액', '잔액', '설명'];

      doc.fontSize(9);
      let xPos = 50;
      headers.forEach((header, i) => {
        doc.text(header, xPos, tableTop, { width: colWidths[i], align: 'left' });
        xPos += colWidths[i];
      });

      doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).stroke();

      // 거래 내역 (최대 50개)
      let yPos = tableTop + 20;
      const maxRows = Math.min(transactions.length, 50);

      for (let i = 0; i < maxRows; i++) {
        const tx = transactions[i];
        xPos = 50;

        // 페이지 넘김 체크
        if (yPos > 750) {
          doc.addPage();
          yPos = 50;
        }

        const rowData = [
          formatDate(tx.createdAt),
          txTypeToKorean(tx.type),
          formatCurrency(toNumber(tx.amount)),
          formatCurrency(toNumber(tx.balanceAfter)),
          (tx.description || '').substring(0, 30),
        ];

        rowData.forEach((data, j) => {
          doc.text(data, xPos, yPos, { width: colWidths[j], align: 'left' });
          xPos += colWidths[j];
        });

        yPos += 15;
      }

      if (transactions.length > 50) {
        doc.moveDown();
        doc.text(`... 외 ${transactions.length - 50}건 (전체 내역은 CSV를 다운로드하세요)`);
      }

      // 푸터
      doc.moveDown(2);
      doc.fontSize(8).text(`생성일시: ${formatDateTime(new Date())}`, { align: 'right' });
      doc.text(`문서ID: ${wallet.id.substring(0, 8)}`, { align: 'right' });

      doc.end();
    });
  }
}

export const statementsService = new StatementsService();
