import { PrismaClient, RoiReportType, RoiReportStatus } from '@prisma/client';
import { cloudinaryService } from './cloudinary.service';
import { localStorageService } from './localStorage.service';
import { NotFoundError, BadRequestError } from '../utils/errors';
import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import os from 'os';

const prisma = new PrismaClient();

// 스토리지 서비스 선택 헬퍼
const getStorageService = () => {
  if (cloudinaryService.isConfigured()) {
    return cloudinaryService;
  }
  console.log('[ROI Report] Cloudinary not configured, using local storage');
  return localStorageService;
};

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

      // 스토리지 업로드 (Cloudinary 또는 Local)
      const buffer = fs.readFileSync(tempPath);
      const storage = getStorageService();
      const uploadResult = await storage.uploadBuffer(buffer, 'assets' as any, {
        filename: `roi_report_${report.id}.pdf`,
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

      // 한글 폰트 설정 (Windows: 맑은 고딕)
      const fontPath = 'C:/Windows/Fonts/malgun.ttf';
      if (fs.existsSync(fontPath)) {
        doc.registerFont('Korean', fontPath);
        doc.font('Korean');
      }

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
      doc.fontSize(16).text('캠페인 정보', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12)
        .text(`캠페인명: ${data.campaign.name}`)
        .text(`브랜드: ${data.campaign.brand.name}`)
        .text(`예산: ${this.formatCurrency(data.campaign.budget)}`);
      doc.moveDown(2);

      // KPI 요약
      doc.fontSize(16).text('KPI 요약', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12)
        .text(`총 노출 횟수: ${data.metrics.totalExposures}회`)
        .text(`유효 노출 횟수: ${data.metrics.validExposures}회`)
        .text(`유효율: ${(data.metrics.validityRate * 100).toFixed(1)}%`)
        .text(`총 노출 시간: ${this.formatDurationKo(data.metrics.totalDuration)}`)
        .text(`평균 신뢰도: ${(data.metrics.avgConfidence * 100).toFixed(1)}%`);
      doc.moveDown(2);

      // 슬롯별 성과
      if (data.metrics.slotMetrics.length > 0) {
        doc.fontSize(16).text('슬롯별 성과', { underline: true });
        doc.moveDown(0.5);

        for (const slot of data.metrics.slotMetrics) {
          doc.fontSize(12)
            .text(`${slot.slotType}: ${slot.exposureCount}회 노출, ${this.formatDurationKo(slot.totalDuration)}`);
        }
        doc.moveDown(2);
      }

      // 검수 현황
      doc.fontSize(16).text('검수 현황', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12)
        .text(`대기 중: ${data.metrics.reviewStats.pending}건`)
        .text(`승인됨: ${data.metrics.reviewStats.approved}건`)
        .text(`거부됨: ${data.metrics.reviewStats.rejected}건`);
      doc.moveDown(2);

      // 푸터
      doc.fontSize(10)
        .text(
          `생성일시: ${new Date().toLocaleString('ko-KR')} | SPONPIK ROI 리포트 시스템`,
          { align: 'center' }
        );

      doc.end();

      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
  }

  /**
   * 유틸리티: 시간 포맷 (한글)
   */
  private formatDurationKo(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}시간 ${minutes}분 ${secs}초`;
    }
    if (minutes > 0) {
      return `${minutes}분 ${secs}초`;
    }
    return `${secs}초`;
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

    // 스토리지에서 삭제 (Cloudinary 또는 Local)
    if (report.fileKey) {
      const storage = getStorageService();
      await storage.deleteFile(report.fileKey);
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

    // 슬롯별 통계를 객체 형태로 변환 (프론트엔드 호환)
    const slotStats: Record<string, { count: number; duration: number }> = {};
    for (const slot of metrics.slotMetrics) {
      slotStats[slot.slotType] = {
        count: slot.exposureCount,
        duration: slot.totalDuration,
      };
    }

    return {
      // 기존 구조
      metrics,
      recentReports,
      vodStats: Object.fromEntries(vodStats.map(v => [v.status, v._count])),
      // 프론트엔드 호환 필드 (플랫 구조)
      totalExposures: metrics.totalExposures,
      validExposures: metrics.validExposures,
      totalDuration: metrics.totalDuration,
      avgConfidence: metrics.avgConfidence,
      slotStats,
      reviewStatus: metrics.reviewStats,
    };
  }

  /**
   * 이벤트(라운드)별 메트릭 집계
   */
  async getEventMetrics(campaignId: string): Promise<Array<{
    eventId: string;
    eventName: string;
    tour: string;
    dateStart: Date;
    dateEnd: Date;
    totalExposures: number;
    validExposures: number;
    totalDuration: number;
    avgConfidence: number;
    slotBreakdown: Record<string, { count: number; duration: number }>;
  }>> {
    // 캠페인에 연결된 VOD의 이벤트별 노출 집계
    const exposures = await prisma.roiExposure.findMany({
      where: { campaignId },
      include: {
        vodAsset: {
          select: { eventId: true },
        },
      },
    });

    // 이벤트별 그룹핑
    const eventMap = new Map<string, typeof exposures>();
    for (const e of exposures) {
      const eventId = e.vodAsset.eventId || 'NO_EVENT';
      if (!eventMap.has(eventId)) {
        eventMap.set(eventId, []);
      }
      eventMap.get(eventId)!.push(e);
    }

    // 이벤트 정보 조회
    const eventIds = Array.from(eventMap.keys()).filter(id => id !== 'NO_EVENT');
    const events = eventIds.length > 0
      ? await prisma.event.findMany({ where: { id: { in: eventIds } } })
      : [];
    const eventInfo = new Map(events.map(e => [e.id, e]));

    const results = [];
    for (const [eventId, exps] of eventMap.entries()) {
      const event = eventInfo.get(eventId);
      const valid = exps.filter(e => e.isValid);

      // 슬롯별 소계
      const slotBreakdown: Record<string, { count: number; duration: number }> = {};
      for (const e of valid) {
        const slot = e.slotType || 'UNKNOWN';
        if (!slotBreakdown[slot]) slotBreakdown[slot] = { count: 0, duration: 0 };
        slotBreakdown[slot].count++;
        slotBreakdown[slot].duration += e.duration;
      }

      results.push({
        eventId,
        eventName: event?.name || '이벤트 미지정',
        tour: event?.tour || '',
        dateStart: event?.dateStart || new Date(),
        dateEnd: event?.dateEnd || new Date(),
        totalExposures: exps.length,
        validExposures: valid.length,
        totalDuration: valid.reduce((s, e) => s + e.duration, 0),
        avgConfidence: valid.length > 0
          ? valid.reduce((s, e) => s + e.avgConfidence, 0) / valid.length
          : 0,
        slotBreakdown,
      });
    }

    // 날짜 순 정렬
    results.sort((a, b) => a.dateStart.getTime() - b.dateStart.getTime());
    return results;
  }

  /**
   * 슬롯 성과 분석 (Slot Analytics 전용)
   */
  async getSlotAnalytics(campaignId: string): Promise<{
    slots: Array<{
      slotType: string;
      exposureCount: number;
      validCount: number;
      totalDuration: number;
      avgConfidence: number;
      validityRate: number;
      avgAreaRatio: number;
    }>;
    totalExposures: number;
    totalDuration: number;
  }> {
    const exposures = await prisma.roiExposure.findMany({
      where: { campaignId },
    });

    const slotMap = new Map<string, {
      total: number;
      valid: number;
      duration: number;
      confidences: number[];
      areaRatios: number[];
    }>();

    for (const e of exposures) {
      const slot = e.slotType || 'UNKNOWN';
      if (!slotMap.has(slot)) {
        slotMap.set(slot, { total: 0, valid: 0, duration: 0, confidences: [], areaRatios: [] });
      }
      const data = slotMap.get(slot)!;
      data.total++;
      if (e.isValid) {
        data.valid++;
        data.duration += e.duration;
      }
      data.confidences.push(e.avgConfidence);
      data.areaRatios.push(e.avgAreaRatio);
    }

    const slots = Array.from(slotMap.entries()).map(([slotType, data]) => ({
      slotType,
      exposureCount: data.total,
      validCount: data.valid,
      totalDuration: data.duration,
      avgConfidence: data.confidences.length > 0
        ? data.confidences.reduce((s, c) => s + c, 0) / data.confidences.length
        : 0,
      validityRate: data.total > 0 ? data.valid / data.total : 0,
      avgAreaRatio: data.areaRatios.length > 0
        ? data.areaRatios.reduce((s, a) => s + a, 0) / data.areaRatios.length
        : 0,
    }));

    // 노출 시간 순 정렬
    slots.sort((a, b) => b.totalDuration - a.totalDuration);

    return {
      slots,
      totalExposures: exposures.length,
      totalDuration: slots.reduce((s, sl) => s + sl.totalDuration, 0),
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
