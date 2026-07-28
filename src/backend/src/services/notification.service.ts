import prisma from '../models/prisma';
import { NotFoundError } from '../utils/errors';
import { NotificationType } from '@prisma/client';

interface NotificationPayload {
  link?: string;
  actionLabel?: string;
  actionUrl?: string;
  entityType?: string;
  entityId?: string;
  /** 알림 종류별 부가 정보 (예: 경매 종료 임박 시간, 추월 사유) */
  hoursLeft?: number;
  reason?: string;
}

interface CreateNotificationData {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
  payload?: NotificationPayload;
}

export class NotificationService {
  /**
   * Create a notification
   */
  async create(data: CreateNotificationData) {
    return prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        data: data.data,
        payload: data.payload as any,
      },
    });
  }

  /**
   * Create multiple notifications (bulk)
   */
  async createMany(notifications: CreateNotificationData[]) {
    return prisma.notification.createMany({
      data: notifications.map((n) => ({
        userId: n.userId,
        type: n.type,
        title: n.title,
        message: n.message,
        data: n.data as any,
        payload: n.payload as any,
      })),
    });
  }

  /**
   * Get notifications for a user
   */
  async getByUser(userId: string, filters: {
    unreadOnly?: boolean;
    limit?: number;
    offset?: number;
  } = {}) {
    const { unreadOnly = false, limit = 50, offset = 0 } = filters;

    const where: any = { userId };
    if (unreadOnly) {
      where.isRead = false;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.notification.count({ where: { userId } }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return { notifications, total, unreadCount };
  }

  /**
   * Get unread count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string) {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundError('Notification not found');
    }

    if (notification.userId !== userId) {
      throw new NotFoundError('Notification not found');
    }

    return prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string) {
    const result = await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    return { count: result.count };
  }

  /**
   * Delete a notification
   */
  async delete(notificationId: string, userId: string) {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundError('Notification not found');
    }

    if (notification.userId !== userId) {
      throw new NotFoundError('Notification not found');
    }

    return prisma.notification.delete({
      where: { id: notificationId },
    });
  }

  /**
   * Delete old notifications (cleanup)
   */
  async deleteOld(olderThanDays = 90): Promise<number> {
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

    const result = await prisma.notification.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        isRead: true,
      },
    });

    return result.count;
  }

  // =============================================
  // Notification Helpers (특정 이벤트에 대한 알림 생성)
  // =============================================

  /**
   * Notify when bid is placed
   */
  async notifyBidPlaced(auctionId: string, brandId: string, amount: number) {
    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        slotInstance: {
          include: { athlete: { include: { user: true } }, event: true },
        },
      },
    });

    if (!auction) return;

    // Notify athlete
    await this.create({
      userId: auction.slotInstance.athlete.userId,
      type: 'BID_PLACED',
      title: '새 입찰',
      message: `${auction.slotInstance.event.name} 경매에 ${amount.toLocaleString()}원 입찰이 들어왔습니다.`,
      payload: {
        link: `/auctions/${auctionId}`,
        entityType: 'AUCTION',
        entityId: auctionId,
      },
    });
  }

  /**
   * Notify when outbid
   */
  async notifyOutbid(auctionId: string, outbidBrandId: string, newAmount: number) {
    const brand = await prisma.brand.findUnique({
      where: { id: outbidBrandId },
      include: { user: true },
    });

    if (!brand) return;

    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: { slotInstance: { include: { event: true, athlete: true } } },
    });

    if (!auction) return;

    await this.create({
      userId: brand.userId,
      type: 'BID_OUTBID',
      title: '입찰 추월됨',
      message: `${auction.slotInstance.event.name} - ${auction.slotInstance.athlete.name} 경매에서 입찰이 추월되었습니다. 현재가: ${newAmount.toLocaleString()}원`,
      payload: {
        link: `/auctions/${auctionId}`,
        entityType: 'AUCTION',
        entityId: auctionId,
      },
    });
  }

  /**
   * 개편 Phase 4 (AUC-15) — 자동입찰 상한 초과 안내
   * 설정한 최대입찰가까지 자동으로 올렸는데도 추월당한 경우에만 보낸다.
   */
  async notifyAutoBidCapExceeded(auctionId: string, brandId: string, newAmount: number) {
    const brand = await prisma.brand.findUnique({ where: { id: brandId }, include: { user: true } });
    if (!brand) return;
    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: { slotInstance: { include: { event: true, athlete: true } } },
    });
    if (!auction) return;

    await this.create({
      userId: brand.userId,
      type: 'BID_OUTBID',
      title: '자동입찰 상한 초과',
      message: `${auction.slotInstance.athlete.name} 경매에서 설정하신 최대입찰가를 넘어섰습니다. 계속 참여하시려면 최대입찰가를 올려주세요. 현재가: ${newAmount.toLocaleString()}원`,
      payload: { link: `/auctions/${auctionId}`, entityType: 'AUCTION', entityId: auctionId, reason: 'AUTO_BID_CAP_EXCEEDED' },
    });
  }

  /**
   * 개편 Phase 4 (AUC-15) — 경매 종료 임박 안내 (24시간 전 / 1시간 전)
   * 입찰 참여 브랜드 전원에게 발송한다.
   */
  async notifyAuctionEndingSoon(auctionId: string, hoursLeft: number) {
    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        slotInstance: { include: { event: true, athlete: true, slotTemplate: true } },
        bids: { select: { brandId: true } },
      },
    });
    if (!auction) return 0;

    const brandIds = [...new Set(auction.bids.map((b) => b.brandId))];
    if (brandIds.length === 0) return 0;
    const brands = await prisma.brand.findMany({ where: { id: { in: brandIds } }, select: { userId: true } });

    const label = hoursLeft >= 24 ? '24시간' : '1시간';
    for (const b of brands) {
      await this.create({
        userId: b.userId,
        type: 'AUCTION_ENDING_SOON',
        title: `경매 종료 ${label} 전`,
        message: `${auction.slotInstance.athlete.name} · ${auction.slotInstance.slotTemplate.name} 경매가 ${label} 후 종료됩니다. 현재가: ${auction.currentPrice.toLocaleString()}원`,
        payload: { link: `/auctions/${auctionId}`, entityType: 'AUCTION', entityId: auctionId, hoursLeft },
      });
    }
    return brands.length;
  }

  /**
   * Notify auction won
   */
  async notifyAuctionWon(auctionId: string, brandId: string) {
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      include: { user: true },
    });

    if (!brand) return;

    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: { slotInstance: { include: { event: true, athlete: true } } },
    });

    if (!auction) return;

    await this.create({
      userId: brand.userId,
      type: 'AUCTION_WON',
      title: '낙찰 완료',
      message: `${auction.slotInstance.event.name} - ${auction.slotInstance.athlete.name} 경매에서 낙찰되었습니다. 낙찰가: ${auction.currentPrice.toLocaleString()}원`,
      payload: {
        link: `/contracts`,
        entityType: 'AUCTION',
        entityId: auctionId,
      },
    });
  }

  /**
   * Notify auction lost
   */
  async notifyAuctionLost(auctionId: string, brandId: string) {
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      include: { user: true },
    });

    if (!brand) return;

    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: { slotInstance: { include: { event: true, athlete: true } } },
    });

    if (!auction) return;

    await this.create({
      userId: brand.userId,
      type: 'AUCTION_LOST',
      title: '낙찰 실패',
      message: `${auction.slotInstance.event.name} - ${auction.slotInstance.athlete.name} 경매에서 낙찰받지 못했습니다.`,
      payload: {
        link: `/auctions`,
        entityType: 'AUCTION',
        entityId: auctionId,
      },
    });
  }

  /**
   * Notify contract created
   */
  async notifyContractCreated(contractId: string) {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        brand: { include: { user: true } },
        athlete: { include: { user: true } },
        auction: { include: { slotInstance: { include: { event: true } } } },
      },
    });

    if (!contract) return;

    const eventName = contract.auction.slotInstance.event.name;

    // Notify brand
    await this.create({
      userId: contract.brand.userId,
      type: 'CONTRACT_CREATED',
      title: '계약 생성',
      message: `${eventName} - ${contract.athlete.name} 계약이 생성되었습니다. 서명을 진행해주세요.`,
      payload: {
        link: `/contracts`,
        entityType: 'CONTRACT',
        entityId: contractId,
      },
    });

    // Notify athlete
    await this.create({
      userId: contract.athlete.userId,
      type: 'CONTRACT_CREATED',
      title: '계약 생성',
      message: `${eventName} - ${contract.brand.name} 브랜드와의 계약이 생성되었습니다. 서명을 진행해주세요.`,
      payload: {
        link: `/contracts`,
        entityType: 'CONTRACT',
        entityId: contractId,
      },
    });
  }

  /**
   * Notify asset submitted
   */
  async notifyAssetSubmitted(contractId: string) {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        athlete: { include: { user: true } },
        brand: true,
      },
    });

    if (!contract) return;

    // Notify athlete that brand uploaded asset
    await this.create({
      userId: contract.athlete.userId,
      type: 'ASSET_SUBMITTED',
      title: '에셋 업로드됨',
      message: `${contract.brand.name} 브랜드가 에셋을 업로드했습니다. 관리자 검토 후 결과가 통보됩니다.`,
      payload: {
        link: `/contracts`,
        entityType: 'CONTRACT',
        entityId: contractId,
      },
    });
  }

  /**
   * Notify asset approved
   */
  async notifyAssetApproved(contractId: string) {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        brand: { include: { user: true } },
        athlete: { include: { user: true } },
      },
    });

    if (!contract) return;

    // Notify both
    await this.createMany([
      {
        userId: contract.brand.userId,
        type: 'ASSET_APPROVED',
        title: '에셋 승인',
        message: '업로드한 에셋이 승인되었습니다.',
        payload: {
          link: `/contracts`,
          entityType: 'CONTRACT',
          entityId: contractId,
        },
      },
      {
        userId: contract.athlete.userId,
        type: 'ASSET_APPROVED',
        title: '에셋 승인',
        message: '브랜드 에셋이 승인되었습니다. 이제 노출 인증을 진행해주세요.',
        payload: {
          link: `/contracts`,
          entityType: 'CONTRACT',
          entityId: contractId,
        },
      },
    ]);
  }

  /**
   * Notify asset rejected
   */
  async notifyAssetRejected(contractId: string, reason?: string) {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        brand: { include: { user: true } },
      },
    });

    if (!contract) return;

    await this.create({
      userId: contract.brand.userId,
      type: 'ASSET_REJECTED',
      title: '에셋 반려',
      message: reason ? `에셋이 반려되었습니다. 사유: ${reason}` : '에셋이 반려되었습니다. 수정 후 다시 업로드해주세요.',
      payload: {
        link: `/contracts`,
        entityType: 'CONTRACT',
        entityId: contractId,
      },
    });
  }

  /**
   * Notify verification submitted
   */
  async notifyVerificationSubmitted(contractId: string) {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        brand: { include: { user: true } },
        athlete: true,
      },
    });

    if (!contract) return;

    await this.create({
      userId: contract.brand.userId,
      type: 'VERIFICATION_SUBMITTED',
      title: '노출 인증 제출',
      message: `${contract.athlete.name} 선수가 노출 인증 사진을 제출했습니다. 관리자 검토 후 결과가 통보됩니다.`,
      payload: {
        link: `/contracts`,
        entityType: 'CONTRACT',
        entityId: contractId,
      },
    });
  }

  /**
   * Notify verification approved
   */
  async notifyVerificationApproved(contractId: string) {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        brand: { include: { user: true } },
        athlete: { include: { user: true } },
      },
    });

    if (!contract) return;

    await this.createMany([
      {
        userId: contract.brand.userId,
        type: 'VERIFICATION_APPROVED',
        title: '노출 인증 승인',
        message: '노출 인증이 승인되었습니다. 계약이 완료되었습니다.',
        payload: {
          link: `/contracts`,
          entityType: 'CONTRACT',
          entityId: contractId,
        },
      },
      {
        userId: contract.athlete.userId,
        type: 'VERIFICATION_APPROVED',
        title: '노출 인증 승인',
        message: '노출 인증이 승인되었습니다. 정산이 진행됩니다.',
        payload: {
          link: `/contracts`,
          entityType: 'CONTRACT',
          entityId: contractId,
        },
      },
    ]);
  }

  /**
   * Notify verification rejected
   */
  async notifyVerificationRejected(contractId: string, reason?: string) {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        athlete: { include: { user: true } },
      },
    });

    if (!contract) return;

    await this.create({
      userId: contract.athlete.userId,
      type: 'VERIFICATION_REJECTED',
      title: '노출 인증 반려',
      message: reason ? `노출 인증이 반려되었습니다. 사유: ${reason}` : '노출 인증이 반려되었습니다. 다시 제출해주세요.',
      payload: {
        link: `/contracts`,
        entityType: 'CONTRACT',
        entityId: contractId,
      },
    });
  }

  /**
   * Notify settlement completed
   */
  async notifySettlementCompleted(contractId: string, amount: number) {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        athlete: { include: { user: true } },
      },
    });

    if (!contract) return;

    await this.create({
      userId: contract.athlete.userId,
      type: 'SETTLEMENT_COMPLETED',
      title: '정산 완료',
      message: `${amount.toLocaleString()}원이 지급되었습니다.`,
      payload: {
        link: `/contracts`,
        entityType: 'CONTRACT',
        entityId: contractId,
      },
    });
  }

  /**
   * Notify all ADMIN users with an alert
   */
  async notifyAdminAlert(alerts: Array<{
    type: string;
    severity: string;
    title: string;
    detail: string;
    value: number;
    threshold: number;
  }>) {
    if (alerts.length === 0) return 0;

    // Find all ADMIN users
    const adminUsers = await prisma.user.findMany({
      where: { role: 'ADMIN', isActive: true },
      select: { id: true },
    });

    if (adminUsers.length === 0) return 0;

    // Create notification for each admin
    const notifications: CreateNotificationData[] = [];

    for (const admin of adminUsers) {
      // 심각도별로 가장 심각한 것 먼저, 최대 5개만 알림
      const topAlerts = alerts.slice(0, 5);
      const alertSummary = topAlerts.map(a => `[${a.severity.toUpperCase()}] ${a.title}`).join(', ');

      notifications.push({
        userId: admin.id,
        type: 'ADMIN_ALERT',
        title: `운영 이상징후 감지 (${alerts.length}건)`,
        message: alertSummary,
        data: { alerts },
        payload: {
          link: '/admin/reports',
          actionLabel: '리포트 보기',
          actionUrl: '/admin/reports',
        },
      });
    }

    await this.createMany(notifications);
    return notifications.length;
  }
}

export const notificationService = new NotificationService();
