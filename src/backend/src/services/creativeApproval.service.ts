/**
 * Creative Approval Service
 * 브랜드의 대회별 사전 크리에이티브 승인 관리
 */

import prisma from '../models/prisma';
import { NotFoundError, ConflictError, BadRequestError, ForbiddenError } from '../utils/errors';

export class CreativeApprovalService {
  /**
   * 브랜드가 대회에 크리에이티브 승인 요청 제출
   */
  async submit(data: {
    brandId: string;
    eventId: string;
    fileUrl: string;
    fileName?: string;
    fileType?: string;
    fileSizeBytes?: number;
  }) {
    // 대회 존재 여부 확인
    const event = await prisma.event.findUnique({ where: { id: data.eventId } });
    if (!event) {
      throw new NotFoundError('대회를 찾을 수 없습니다.');
    }

    // 브랜드 존재 여부 확인
    const brand = await prisma.brand.findUnique({ where: { id: data.brandId } });
    if (!brand) {
      throw new NotFoundError('브랜드를 찾을 수 없습니다.');
    }

    // 이미 제출된 요청이 있는지 확인
    const existing = await prisma.brandEventCreativeApproval.findUnique({
      where: {
        brandId_eventId: {
          brandId: data.brandId,
          eventId: data.eventId,
        },
      },
    });

    if (existing) {
      // REJECTED 상태면 재제출 가능
      if (existing.status === 'REJECTED') {
        return prisma.brandEventCreativeApproval.update({
          where: { id: existing.id },
          data: {
            fileUrl: data.fileUrl,
            fileName: data.fileName,
            fileType: data.fileType,
            fileSizeBytes: data.fileSizeBytes,
            status: 'SUBMITTED',
            reviewNotes: null,
            reviewedBy: null,
            reviewedAt: null,
          },
          include: { brand: true, event: true },
        });
      }
      throw new ConflictError('이미 크리에이티브 승인 요청이 존재합니다.');
    }

    return prisma.brandEventCreativeApproval.create({
      data: {
        brandId: data.brandId,
        eventId: data.eventId,
        fileUrl: data.fileUrl,
        fileName: data.fileName,
        fileType: data.fileType,
        fileSizeBytes: data.fileSizeBytes,
        status: 'SUBMITTED',
      },
      include: { brand: true, event: true },
    });
  }

  /**
   * 브랜드의 대회별 크리에이티브 승인 상태 조회
   */
  async getByBrandAndEvent(brandId: string, eventId: string) {
    return prisma.brandEventCreativeApproval.findUnique({
      where: {
        brandId_eventId: { brandId, eventId },
      },
      include: { brand: true, event: true },
    });
  }

  /**
   * 브랜드의 모든 크리에이티브 승인 요청 목록
   */
  async listByBrand(brandId: string) {
    return prisma.brandEventCreativeApproval.findMany({
      where: { brandId },
      include: { event: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 대회의 모든 크리에이티브 승인 요청 목록 (Admin)
   */
  async listByEvent(eventId: string, status?: string) {
    const where: any = { eventId };
    if (status) {
      where.status = status;
    }

    return prisma.brandEventCreativeApproval.findMany({
      where,
      include: { brand: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 크리에이티브 승인 요청 목록 (Admin - 전체)
   */
  async listAll(params: {
    status?: string;
    eventId?: string;
    brandId?: string;
    skip?: number;
    take?: number;
  }) {
    const where: any = {};
    if (params.status) where.status = params.status;
    if (params.eventId) where.eventId = params.eventId;
    if (params.brandId) where.brandId = params.brandId;

    const [items, total] = await Promise.all([
      prisma.brandEventCreativeApproval.findMany({
        where,
        include: { brand: true, event: true },
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.take,
      }),
      prisma.brandEventCreativeApproval.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * 크리에이티브 승인 (Admin)
   */
  async approve(id: string, adminUserId: string, reviewNotes?: string) {
    const approval = await prisma.brandEventCreativeApproval.findUnique({
      where: { id },
    });

    if (!approval) {
      throw new NotFoundError('크리에이티브 승인 요청을 찾을 수 없습니다.');
    }

    if (approval.status !== 'SUBMITTED' && approval.status !== 'UNDER_REVIEW') {
      throw new BadRequestError('SUBMITTED 또는 UNDER_REVIEW 상태에서만 승인 가능합니다.');
    }

    return prisma.brandEventCreativeApproval.update({
      where: { id },
      data: {
        status: 'APPROVED',
        reviewNotes,
        reviewedBy: adminUserId,
        reviewedAt: new Date(),
      },
      include: { brand: true, event: true },
    });
  }

  /**
   * 크리에이티브 거부 (Admin)
   */
  async reject(id: string, adminUserId: string, reviewNotes: string) {
    if (!reviewNotes || reviewNotes.length < 10) {
      throw new BadRequestError('거부 사유는 최소 10자 이상 입력해주세요.');
    }

    const approval = await prisma.brandEventCreativeApproval.findUnique({
      where: { id },
    });

    if (!approval) {
      throw new NotFoundError('크리에이티브 승인 요청을 찾을 수 없습니다.');
    }

    if (approval.status !== 'SUBMITTED' && approval.status !== 'UNDER_REVIEW') {
      throw new BadRequestError('SUBMITTED 또는 UNDER_REVIEW 상태에서만 거부 가능합니다.');
    }

    return prisma.brandEventCreativeApproval.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewNotes,
        reviewedBy: adminUserId,
        reviewedAt: new Date(),
      },
      include: { brand: true, event: true },
    });
  }

  /**
   * 검토 시작 (Admin)
   */
  async startReview(id: string, adminUserId: string) {
    const approval = await prisma.brandEventCreativeApproval.findUnique({
      where: { id },
    });

    if (!approval) {
      throw new NotFoundError('크리에이티브 승인 요청을 찾을 수 없습니다.');
    }

    if (approval.status !== 'SUBMITTED') {
      throw new BadRequestError('SUBMITTED 상태에서만 검토 시작 가능합니다.');
    }

    return prisma.brandEventCreativeApproval.update({
      where: { id },
      data: {
        status: 'UNDER_REVIEW',
        reviewedBy: adminUserId,
      },
      include: { brand: true, event: true },
    });
  }

  /**
   * 브랜드가 특정 대회에서 크리에이티브 승인을 받았는지 확인
   */
  async isApproved(brandId: string, eventId: string): Promise<boolean> {
    const approval = await prisma.brandEventCreativeApproval.findUnique({
      where: {
        brandId_eventId: { brandId, eventId },
      },
    });

    return approval?.status === 'APPROVED';
  }

  /**
   * 통계 (Admin)
   */
  async getStats(eventId?: string) {
    const where: any = {};
    if (eventId) where.eventId = eventId;

    const [submitted, underReview, approved, rejected, total] = await Promise.all([
      prisma.brandEventCreativeApproval.count({ where: { ...where, status: 'SUBMITTED' } }),
      prisma.brandEventCreativeApproval.count({ where: { ...where, status: 'UNDER_REVIEW' } }),
      prisma.brandEventCreativeApproval.count({ where: { ...where, status: 'APPROVED' } }),
      prisma.brandEventCreativeApproval.count({ where: { ...where, status: 'REJECTED' } }),
      prisma.brandEventCreativeApproval.count({ where }),
    ]);

    return {
      submitted,
      underReview,
      approved,
      rejected,
      total,
      pending: submitted + underReview,
    };
  }
}

export const creativeApprovalService = new CreativeApprovalService();
