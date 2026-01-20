/**
 * Report Service
 *
 * 신고/분쟁 관리 서비스
 * - 신고 접수/조회/처리
 * - 상태 변경 및 이력 관리
 * - 담당자 지정 및 댓글 추가
 */

import prisma from '../models/prisma';
import { ReportType, ReportStatus, ReportPriority, Report, ReportComment, Prisma } from '@prisma/client';

interface CreateReportData {
  reporterUserId: string;
  type: ReportType;
  targetType: string;
  targetId: string;
  title: string;
  description: string;
  evidenceUrls?: string[];
  priority?: ReportPriority;
}

interface UpdateReportData {
  status?: ReportStatus;
  priority?: ReportPriority;
  assignedTo?: string;
  resolution?: string;
}

interface ReportFilters {
  status?: ReportStatus;
  priority?: ReportPriority;
  type?: ReportType;
  assignedTo?: string;
  reporterUserId?: string;
  targetType?: string;
  q?: string;
}

interface ReportWithDetails extends Report {
  comments: ReportComment[];
  _count?: {
    comments: number;
  };
}

class ReportService {
  // ============================================
  // Public API (User)
  // ============================================

  /**
   * 신고 접수 (User)
   */
  async createReport(data: CreateReportData): Promise<Report> {
    const report = await prisma.report.create({
      data: {
        reporterUserId: data.reporterUserId,
        type: data.type,
        targetType: data.targetType,
        targetId: data.targetId,
        title: data.title,
        description: data.description,
        evidenceUrls: data.evidenceUrls || [],
        priority: data.priority || 'MEDIUM',
      },
    });

    // 이력 기록
    await this.addHistory(report.id, data.reporterUserId, 'CREATED', null, 'OPEN');

    return report;
  }

  /**
   * 내 신고 목록 조회 (User)
   */
  async getMyReports(userId: string): Promise<Report[]> {
    return prisma.report.findMany({
      where: { reporterUserId: userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 내 신고 상세 조회 (User)
   */
  async getMyReport(userId: string, reportId: string): Promise<ReportWithDetails | null> {
    const report = await prisma.report.findFirst({
      where: {
        id: reportId,
        reporterUserId: userId,
      },
      include: {
        comments: {
          where: { isInternal: false }, // 내부 댓글 제외
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return report;
  }

  // ============================================
  // Admin API
  // ============================================

  /**
   * 신고 목록 조회 (Admin)
   */
  async getReports(filters?: ReportFilters): Promise<Report[]> {
    const where: Prisma.ReportWhereInput = {};

    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.priority) {
      where.priority = filters.priority;
    }
    if (filters?.type) {
      where.type = filters.type;
    }
    if (filters?.assignedTo) {
      where.assignedTo = filters.assignedTo;
    }
    if (filters?.reporterUserId) {
      where.reporterUserId = filters.reporterUserId;
    }
    if (filters?.targetType) {
      where.targetType = filters.targetType;
    }
    if (filters?.q) {
      where.OR = [
        { title: { contains: filters.q, mode: 'insensitive' } },
        { description: { contains: filters.q, mode: 'insensitive' } },
      ];
    }

    return prisma.report.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * 신고 상세 조회 (Admin)
   */
  async getReport(id: string): Promise<ReportWithDetails | null> {
    return prisma.report.findUnique({
      where: { id },
      include: {
        comments: {
          orderBy: { createdAt: 'asc' },
        },
        history: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  /**
   * 신고 상태 변경 (Admin)
   */
  async updateStatus(id: string, adminId: string, newStatus: ReportStatus): Promise<Report> {
    const report = await prisma.report.findUnique({ where: { id } });
    if (!report) {
      throw new Error('Report not found');
    }

    const oldStatus = report.status;

    const updatedReport = await prisma.report.update({
      where: { id },
      data: { status: newStatus },
    });

    await this.addHistory(id, adminId, 'STATUS_CHANGE', oldStatus, newStatus);

    return updatedReport;
  }

  /**
   * 담당자 지정 (Admin)
   */
  async assignReport(id: string, adminId: string, assignedTo: string): Promise<Report> {
    const report = await prisma.report.findUnique({ where: { id } });
    if (!report) {
      throw new Error('Report not found');
    }

    const updatedReport = await prisma.report.update({
      where: { id },
      data: { assignedTo },
    });

    await this.addHistory(id, adminId, 'ASSIGNED', report.assignedTo || null, assignedTo);

    return updatedReport;
  }

  /**
   * 우선순위 변경 (Admin)
   */
  async updatePriority(id: string, adminId: string, newPriority: ReportPriority): Promise<Report> {
    const report = await prisma.report.findUnique({ where: { id } });
    if (!report) {
      throw new Error('Report not found');
    }

    const oldPriority = report.priority;

    const updatedReport = await prisma.report.update({
      where: { id },
      data: { priority: newPriority },
    });

    await this.addHistory(id, adminId, 'PRIORITY_CHANGE', oldPriority, newPriority);

    return updatedReport;
  }

  /**
   * 신고 해결 (Admin)
   */
  async resolveReport(id: string, adminId: string, resolution: string, status: ReportStatus = 'RESOLVED'): Promise<Report> {
    const report = await prisma.report.findUnique({ where: { id } });
    if (!report) {
      throw new Error('Report not found');
    }

    const oldStatus = report.status;

    const updatedReport = await prisma.report.update({
      where: { id },
      data: {
        status,
        resolution,
        resolvedBy: adminId,
        resolvedAt: new Date(),
      },
    });

    await this.addHistory(id, adminId, 'STATUS_CHANGE', oldStatus, status);

    return updatedReport;
  }

  /**
   * 댓글 추가 (Admin or User)
   */
  async addComment(
    reportId: string,
    userId: string,
    content: string,
    isInternal: boolean = false
  ): Promise<ReportComment> {
    const report = await prisma.report.findUnique({ where: { id: reportId } });
    if (!report) {
      throw new Error('Report not found');
    }

    const comment = await prisma.reportComment.create({
      data: {
        reportId,
        userId,
        content,
        isInternal,
      },
    });

    await this.addHistory(reportId, userId, 'COMMENT_ADDED', null, isInternal ? 'INTERNAL' : 'PUBLIC');

    return comment;
  }

  /**
   * 이력 기록 (내부)
   */
  private async addHistory(
    reportId: string,
    userId: string,
    action: string,
    oldValue: string | null,
    newValue: string | null
  ): Promise<void> {
    await prisma.reportHistory.create({
      data: {
        reportId,
        userId,
        action,
        oldValue,
        newValue,
      },
    });
  }

  /**
   * 신고 통계 (Admin)
   */
  async getReportStats(): Promise<{
    total: number;
    open: number;
    inReview: number;
    pendingInfo: number;
    escalated: number;
    resolved: number;
    dismissed: number;
    byPriority: { priority: ReportPriority; count: number }[];
    byType: { type: ReportType; count: number }[];
  }> {
    const [total, byStatus, byPriority, byType] = await Promise.all([
      prisma.report.count(),
      prisma.report.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      prisma.report.groupBy({
        by: ['priority'],
        where: { status: { notIn: ['RESOLVED', 'DISMISSED'] } },
        _count: { id: true },
      }),
      prisma.report.groupBy({
        by: ['type'],
        _count: { id: true },
      }),
    ]);

    const statusMap = Object.fromEntries(
      byStatus.map((s) => [s.status, s._count.id])
    );

    return {
      total,
      open: statusMap['OPEN'] || 0,
      inReview: statusMap['IN_REVIEW'] || 0,
      pendingInfo: statusMap['PENDING_INFO'] || 0,
      escalated: statusMap['ESCALATED'] || 0,
      resolved: statusMap['RESOLVED'] || 0,
      dismissed: statusMap['DISMISSED'] || 0,
      byPriority: byPriority.map((p) => ({ priority: p.priority, count: p._count.id })),
      byType: byType.map((t) => ({ type: t.type, count: t._count.id })),
    };
  }
}

export const reportService = new ReportService();
