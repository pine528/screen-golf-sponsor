import { PrismaClient, RoiReportType, RoiReportStatus } from '@prisma/client';
import { cloudinaryService } from './cloudinary.service';
import { NotFoundError, BadRequestError } from '../utils/errors';
import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import os from 'os';

const prisma = new PrismaClient();

// KPI 메트릭 타입
interface RoiMetrics {
  // 기본 지표
  totalExposures: number;
  validExposures: number;
  totalDuration: number;      // 총 노출 시간 (초)
  avgConfidence: number;      // 평균 신뢰도

  // 슬롯별 지표
  slotMetrics: Array<{
    slotType: string;
    exposureCount: number;
    totalDuration: number;
    avgConfidence: number;
  }>;

  // 시간대별 노출
  timelineData: Array<{
    timestamp: string;        // ISO 날짜
    exposureCount: number;
    duration: number;
  }>;

  // 유효율
  validityRate: number;

  // 검수 현황
  reviewStats: {
    pending: number;
    approved: number;
    rejected: number;
  };
}

class RoiReportService {
  /**
   * 캠페인 ROI 메트릭 계산
   */
  async calculateMetrics(
    campaignId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<RoiMetrics> {
    const { startDate, endDate } = options;

    // 기본 쿼리 조건
    const where: any = { campaignId };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    // 전체 노출 조회
    const exposures = await prisma.roiExposure.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });

    const validExposures = exposures.filter(e => e.isValid);

    // 슬롯별 집계
    const slotMap = new Map<string, { count: number; duration: number; confidence: number[] }>();
    for (const e of validExposures) {
      const slot = e.slotType || 'UNKNOWN';
      if (!slotMap.has(slot)) {
        slotMap.set(slot, { count: 0, duration: 0, confidence: [] });
      }
      const data = slotMap.get(slot)!;
      data.count++;
      data.duration += e.duration;
      data.confidence.push(e.avgConfidence);
    }

    const slotMetrics = Array.from(slotMap.entries()).map(([slotType, data]) => ({
      slotType,
      exposureCount: data.count,
      totalDuration: data.duration,
      avgConfidence: data.confidence.reduce((s, c) => s + c, 0) / data.confidence.length,
    }));

    // 일별 집계 (시간대 데이터)
    const dailyMap = new Map<string, { count: number; duration: number }>();
    for (const e of validExposures) {
      const dateKey = e.createdAt.toISOString().split('T')[0];
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, { count: 0, duration: 0 });
      }
      const data = dailyMap.get(dateKey)!;
      data.count++;
      data.duration += e.duration;
    }

    const timelineData = Array.from(dailyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([timestamp, data]) => ({
        timestamp,
        exposureCount: data.count,
        duration: data.duration,
      }));

    // 검수 현황
    const reviewStats = {
      pending: exposures.filter(e => e.reviewStatus === 'PENDING').length,
      approved: exposures.filter(e => e.reviewStatus === 'APPROVED').length,
      rejected: exposures.filter(e => e.reviewStatus === 'REJECTED').length,
    };

    return {
      totalExposures: exposures.length,
      validExposures: validExposures.length,
      totalDuration: validExposures.reduce((sum, e) => sum + e.duration, 0),
      avgConfidence: validExposures.length > 0
        ? validExposures.reduce((sum, e) => sum + e.avgConfidence, 0) / validExposures.length
        : 0,
      slotMetrics,
      timelineData,
      validityRate: exposures.length > 0 ? validExposures.length / exposures.length : 0,
      reviewStats,
    };
  }

  /**
   * PDF 리포트 생성
   */
  async generatePdfReport(
    campaignId: string,
    options: {
      type?: RoiReportType;
      periodStart?: Date;
      periodEnd?: Date;
      title?: string;
    } = {}
  ): Promise<{
    reportId: string;
    fileUrl: string;
  }> {
    const {
      type = RoiReportType.CAMPAIGN_FINAL,
      periodStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      periodEnd = new Date(),
      title,
    } = options;

    // 캠페인 정보 조회
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        brand: {
          select: { name: true },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundError('캠페인을 찾을 수 없습니다.');
    }

    // 리포트 레코드 생성 (GENERATING 상태)
    const report = await prisma.roiReport.create({
      data: {
        campaignId,
        periodStart,
        periodEnd,
        type,
        title: title || `${campaign.name} ROI 리포트`,
        status: RoiReportStatus.GENERATING,
      },
    });

    try {
      // 메트릭 계산
      const metrics = await this.calculateMetrics(campaignId, {
        startDate: periodStart,
        endDate: periodEnd,
      });

      // PDF 생성
      const tempPath = path.join(os.tmpdir(), `roi_report_${report.id}.pdf`);
      await this.createPdf(tempPath, {
        campaign,
        metrics,
        periodStart,
        periodEnd,
        title: title || `${campaign.name} ROI 리포트`,
      });

      // Cloudinary 업로드
      const buffer = fs.readFileSync(tempPath);
      const uploadResult = await cloudinaryService.uploadBuffer(buffer, 'assets' as any, {
        filename: `roi_report_${report.id}`,
        resource_type: 'raw',
      });

      // 리포트 업데이트
      await prisma.roiReport.update({
        where: { id: report.id },
        data: {
          status: RoiReportStatus.COMPLETED,
          fileKey: uploadResult.public_id,
          fileUrl: uploadResult.secure_url,
          metricsJson: metrics as any,
          generatedAt: new Date(),
        },
      });

      // 임시 파일 삭제
      fs.unlinkSync(tempPath);

      return {
        reportId: report.id,
        fileUrl: uploadResult.secure_url,
      };
    } catch (error) {
      // 실패 시 상태 업데이트
      await prisma.roiReport.update({
        where: { id: report.id },
        data: {
          status: RoiReportStatus.FAILED,
          errorMessage: error instanceof Error ? error.message : 'PDF 생성 실패',
        },
      });
      throw error;
    }
  }

  /**
   * PDF 파일 생성
   */
  private async createPdf(
    outputPath: string,
    data: {
      campaign: any;
      metrics: RoiMetrics;
      periodStart: Date;
      periodEnd: Date;
      title: string;
    }
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const writeStream = fs.createWriteStream(outputPath);

      doc.pipe(writeStream);

      // 폰트 설정 (한글 지원을 위해 시스템 폰트 사용 필요)
      // doc.font('path/to/korean-font.ttf');

      // 제목
      doc.fontSize(24).text(data.title, { align: 'center' });
      doc.moveDown();

      // 기간 정보
      doc.fontSize(12).text(
        `기간: ${this.formatDate(data.periodStart)} ~ ${this.formatDate(data.periodEnd)}`,
        { align: 'center' }
      );
      doc.moveDown(2);

      // 캠페인 정보
      doc.fontSize(16).text('Campaign Information', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12)
        .text(`Campaign: ${data.campaign.name}`)
        .text(`Brand: ${data.campaign.brand.name}`)
        .text(`Budget: ${this.formatCurrency(data.campaign.budget)}`);
      doc.moveDown(2);

      // KPI 요약
      doc.fontSize(16).text('KPI Summary', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12)
        .text(`Total Exposures: ${data.metrics.totalExposures}`)
        .text(`Valid Exposures: ${data.metrics.validExposures}`)
        .text(`Validity Rate: ${(data.metrics.validityRate * 100).toFixed(1)}%`)
        .text(`Total Exposure Time: ${this.formatDuration(data.metrics.totalDuration)}`)
        .text(`Average Confidence: ${(data.metrics.avgConfidence * 100).toFixed(1)}%`);
      doc.moveDown(2);

      // 슬롯별 성과
      if (data.metrics.slotMetrics.length > 0) {
        doc.fontSize(16).text('Slot Performance', { underline: true });
        doc.moveDown(0.5);

        for (const slot of data.metrics.slotMetrics) {
          doc.fontSize(12)
            .text(`${slot.slotType}: ${slot.exposureCount} exposures, ${this.formatDuration(slot.totalDuration)}`);
        }
        doc.moveDown(2);
      }

      // 검수 현황
      doc.fontSize(16).text('Review Status', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12)
        .text(`Pending: ${data.metrics.reviewStats.pending}`)
        .text(`Approved: ${data.metrics.reviewStats.approved}`)
        .text(`Rejected: ${data.metrics.reviewStats.rejected}`);
      doc.moveDown(2);

      // 푸터
      doc.fontSize(10)
        .text(
          `Generated on ${new Date().toISOString()} by SPONPIK ROI Report System`,
          { align: 'center' }
        );

      doc.end();

      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
  }

  /**
   * 리포트 목록 조회
   */
  async listReports(params: {
    campaignId?: string;
    type?: RoiReportType;
    status?: RoiReportStatus;
    page?: number;
    limit?: number;
  }) {
    const { campaignId, type, status, page = 1, limit = 20 } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (campaignId) where.campaignId = campaignId;
    if (type) where.type = type;
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      prisma.roiReport.findMany({
        where,
        include: {
          campaign: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.roiReport.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 리포트 상세 조회
   */
  async getReportById(reportId: string) {
    const report = await prisma.roiReport.findUnique({
      where: { id: reportId },
      include: {
        campaign: {
          select: { id: true, name: true },
        },
      },
    });

    if (!report) {
      throw new NotFoundError('리포트를 찾을 수 없습니다.');
    }

    return report;
  }

  /**
   * 리포트 삭제
   */
  async deleteReport(reportId: string): Promise<void> {
    const report = await prisma.roiReport.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw new NotFoundError('리포트를 찾을 수 없습니다.');
    }

    // Cloudinary에서 삭제
    if (report.fileKey) {
      await cloudinaryService.deleteFile(report.fileKey);
    }

    // DB에서 삭제
    await prisma.roiReport.delete({
      where: { id: reportId },
    });
  }

  /**
   * 대시보드 요약 데이터
   */
  async getDashboardSummary(campaignId: string) {
    const metrics = await this.calculateMetrics(campaignId);

    // 최근 리포트
    const recentReports = await prisma.roiReport.findMany({
      where: { campaignId, status: RoiReportStatus.COMPLETED },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // VOD 현황
    const vodStats = await prisma.vodAsset.groupBy({
      by: ['status'],
      where: { campaignId },
      _count: true,
    });

    return {
      metrics,
      recentReports,
      vodStats: Object.fromEntries(vodStats.map(v => [v.status, v._count])),
    };
  }

  /**
   * 유틸리티: 날짜 포맷
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * 유틸리티: 통화 포맷
   */
  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(amount);
  }

  /**
   * 유틸리티: 시간 포맷
   */
  private formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  }
}

export const roiReportService = new RoiReportService();
