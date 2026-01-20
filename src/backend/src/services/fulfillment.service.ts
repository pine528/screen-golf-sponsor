import { prisma as basePrisma } from '../models/prisma';
import { Prisma, PrismaClient } from '@prisma/client';

// FulfillmentStatus type (will be available after prisma generate)
type FulfillmentStatus =
  | 'NOT_STARTED'
  | 'DESIGNING'
  | 'PRODUCING'
  | 'SHIPPING'
  | 'DELIVERED'
  | 'ATTACHED';

// Cast prisma to any for new models (will be typed after prisma generate)
const prisma = basePrisma as any;

// Transaction client type
type TransactionClient = any;

// 상태 전이 규칙: NOT_STARTED → DESIGNING → PRODUCING → SHIPPING → DELIVERED → ATTACHED
const STATUS_ORDER: FulfillmentStatus[] = [
  'NOT_STARTED',
  'DESIGNING',
  'PRODUCING',
  'SHIPPING',
  'DELIVERED',
  'ATTACHED',
];

function getStatusIndex(status: FulfillmentStatus): number {
  return STATUS_ORDER.indexOf(status);
}

function canTransition(from: FulfillmentStatus, to: FulfillmentStatus): boolean {
  const fromIndex = getStatusIndex(from);
  const toIndex = getStatusIndex(to);
  // 한 단계 앞으로만 가능 (또는 현재 단계 유지)
  return toIndex >= fromIndex && toIndex <= fromIndex + 1;
}

export const fulfillmentService = {
  /**
   * 계약의 이행 상태 조회 (없으면 생성)
   */
  async getOrCreateFulfillment(contractId: string) {
    let fulfillment = await prisma.contractFulfillment.findUnique({
      where: { contractId },
      include: {
        history: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        contract: {
          select: {
            id: true,
            status: true,
            brandId: true,
            athleteId: true,
            priceFinal: true,
            brand: { select: { id: true, name: true } },
            athlete: { select: { id: true, name: true } },
            auction: {
              select: {
                slotInstance: {
                  select: {
                    event: { select: { id: true, name: true, dateStart: true } },
                    slotTemplate: { select: { name: true, bodyPart: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!fulfillment) {
      fulfillment = await prisma.contractFulfillment.create({
        data: { contractId },
        include: {
          history: {
            orderBy: { createdAt: 'desc' },
            take: 20,
          },
          contract: {
            select: {
              id: true,
              status: true,
              brandId: true,
              athleteId: true,
              priceFinal: true,
              brand: { select: { id: true, name: true } },
              athlete: { select: { id: true, name: true } },
              auction: {
                select: {
                  slotInstance: {
                    select: {
                      event: { select: { id: true, name: true, dateStart: true } },
                      slotTemplate: { select: { name: true, bodyPart: true } },
                    },
                  },
                },
              },
            },
          },
        },
      });
    }

    return fulfillment;
  },

  /**
   * 이행 상태 업데이트
   */
  async updateStatus(
    contractId: string,
    newStatus: FulfillmentStatus,
    changedBy: string,
    notes?: string
  ) {
    const fulfillment = await this.getOrCreateFulfillment(contractId);
    const currentStatus = fulfillment.status;

    // 상태 전이 검증 (관리자는 어디로든 이동 가능하도록 검증 완화)
    // if (!canTransition(currentStatus, newStatus)) {
    //   throw new Error(`상태를 ${currentStatus}에서 ${newStatus}로 변경할 수 없습니다`);
    // }

    if (currentStatus === newStatus) {
      return fulfillment;
    }

    const updated = await prisma.$transaction(async (tx: TransactionClient) => {
      // 이력 추가
      await tx.fulfillmentHistory.create({
        data: {
          fulfillmentId: fulfillment.id,
          fromStatus: currentStatus,
          toStatus: newStatus,
          changedBy,
          notes,
          photoUrls: [],
        },
      });

      // 상태 업데이트
      return tx.contractFulfillment.update({
        where: { id: fulfillment.id },
        data: { status: newStatus },
        include: {
          history: {
            orderBy: { createdAt: 'desc' },
            take: 20,
          },
          contract: {
            select: {
              id: true,
              status: true,
              brandId: true,
              athleteId: true,
              brand: { select: { id: true, name: true } },
              athlete: { select: { id: true, name: true } },
            },
          },
        },
      });
    });

    return updated;
  },

  /**
   * 배송 정보 업데이트
   */
  async updateShipping(
    contractId: string,
    data: {
      carrier: string;
      trackingNumber: string;
    },
    changedBy: string
  ) {
    const fulfillment = await this.getOrCreateFulfillment(contractId);

    const updated = await prisma.$transaction(async (tx: TransactionClient) => {
      // 배송 중 상태가 아니면 자동 전환
      let newStatus = fulfillment.status;
      if (
        fulfillment.status === 'NOT_STARTED' ||
        fulfillment.status === 'DESIGNING' ||
        fulfillment.status === 'PRODUCING'
      ) {
        newStatus = 'SHIPPING';
      }

      // 이력 추가
      await tx.fulfillmentHistory.create({
        data: {
          fulfillmentId: fulfillment.id,
          fromStatus: fulfillment.status,
          toStatus: newStatus,
          changedBy,
          notes: `배송 정보 등록: ${data.carrier} - ${data.trackingNumber}`,
          photoUrls: [],
        },
      });

      return tx.contractFulfillment.update({
        where: { id: fulfillment.id },
        data: {
          carrier: data.carrier,
          trackingNumber: data.trackingNumber,
          shippedAt: new Date(),
          status: newStatus,
        },
        include: {
          history: {
            orderBy: { createdAt: 'desc' },
            take: 20,
          },
          contract: {
            select: {
              id: true,
              brand: { select: { id: true, name: true } },
              athlete: { select: { id: true, name: true } },
            },
          },
        },
      });
    });

    return updated;
  },

  /**
   * 배송 완료 처리
   */
  async markDelivered(contractId: string, changedBy: string) {
    const fulfillment = await this.getOrCreateFulfillment(contractId);

    if (fulfillment.status !== 'SHIPPING') {
      throw new Error('배송 중 상태에서만 배송 완료 처리할 수 있습니다');
    }

    const updated = await prisma.$transaction(async (tx: TransactionClient) => {
      await tx.fulfillmentHistory.create({
        data: {
          fulfillmentId: fulfillment.id,
          fromStatus: fulfillment.status,
          toStatus: 'DELIVERED',
          changedBy,
          notes: '배송 완료',
          photoUrls: [],
        },
      });

      return tx.contractFulfillment.update({
        where: { id: fulfillment.id },
        data: {
          status: 'DELIVERED',
          deliveredAt: new Date(),
        },
        include: {
          history: {
            orderBy: { createdAt: 'desc' },
            take: 20,
          },
        },
      });
    });

    return updated;
  },

  /**
   * 부착 사진 추가
   */
  async addAttachmentPhotos(
    contractId: string,
    photoUrls: string[],
    changedBy: string,
    notes?: string
  ) {
    const fulfillment = await this.getOrCreateFulfillment(contractId);

    const updated = await prisma.$transaction(async (tx: TransactionClient) => {
      // 기존 사진 URL과 합침
      const allPhotoUrls = [...fulfillment.attachmentPhotoUrls, ...photoUrls];

      // 이력 추가
      await tx.fulfillmentHistory.create({
        data: {
          fulfillmentId: fulfillment.id,
          fromStatus: fulfillment.status,
          toStatus: 'ATTACHED',
          changedBy,
          notes: notes || '부착 사진 등록',
          photoUrls,
        },
      });

      return tx.contractFulfillment.update({
        where: { id: fulfillment.id },
        data: {
          attachmentPhotoUrls: allPhotoUrls,
          attachedAt: new Date(),
          status: 'ATTACHED',
        },
        include: {
          history: {
            orderBy: { createdAt: 'desc' },
            take: 20,
          },
        },
      });
    });

    return updated;
  },

  /**
   * 이행 이력 조회
   */
  async getHistory(contractId: string) {
    const fulfillment = await prisma.contractFulfillment.findUnique({
      where: { contractId },
    });

    if (!fulfillment) {
      return [];
    }

    return prisma.fulfillmentHistory.findMany({
      where: { fulfillmentId: fulfillment.id },
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * Admin: 이행 현황 목록 조회
   */
  async getFulfillments(filters: {
    status?: FulfillmentStatus;
    brandId?: string;
    athleteId?: string;
  }) {
    const where: any = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.brandId || filters.athleteId) {
      where.contract = {};
      if (filters.brandId) where.contract.brandId = filters.brandId;
      if (filters.athleteId) where.contract.athleteId = filters.athleteId;
    }

    return prisma.contractFulfillment.findMany({
      where,
      include: {
        contract: {
          select: {
            id: true,
            status: true,
            priceFinal: true,
            brand: { select: { id: true, name: true } },
            athlete: { select: { id: true, name: true } },
            auction: {
              select: {
                slotInstance: {
                  select: {
                    event: { select: { name: true, dateStart: true } },
                    slotTemplate: { select: { name: true, bodyPart: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  },

  /**
   * Admin: 이행 통계
   */
  async getStats() {
    const [byStatus, recent] = await Promise.all([
      prisma.contractFulfillment.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      prisma.contractFulfillment.count({
        where: {
          updatedAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 최근 7일
          },
        },
      }),
    ]);

    const statusCounts = STATUS_ORDER.reduce((acc, status) => {
      const found = byStatus.find((b: any) => b.status === status);
      acc[status] = found?._count.id || 0;
      return acc;
    }, {} as Record<FulfillmentStatus, number>);

    return {
      byStatus: statusCounts,
      recentActivity: recent,
      total: Object.values(statusCounts).reduce((a: number, b: number) => a + b, 0),
    };
  },

  /**
   * 메모/노트 업데이트
   */
  async updateNotes(contractId: string, notes: string, changedBy: string) {
    const fulfillment = await this.getOrCreateFulfillment(contractId);

    await prisma.fulfillmentHistory.create({
      data: {
        fulfillmentId: fulfillment.id,
        fromStatus: fulfillment.status,
        toStatus: fulfillment.status,
        changedBy,
        notes: `메모 업데이트: ${notes}`,
        photoUrls: [],
      },
    });

    return prisma.contractFulfillment.update({
      where: { id: fulfillment.id },
      data: { notes },
    });
  },
};
