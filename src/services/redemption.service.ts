import { Prisma, ShopItemStatus, RedemptionStatus } from '@prisma/client';
import prisma from '../models/prisma';
import { pointService } from './point.service';
import { BadRequestError, NotFoundError, ConflictError } from '../utils/errors';

export class RedemptionService {
  /**
   * 상품 목록 조회 (ACTIVE만)
   */
  async listItems(options: { page?: number; pageSize?: number; includeAll?: boolean } = {}) {
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where = options.includeAll ? {} : { status: ShopItemStatus.ACTIVE };

    const [items, total] = await Promise.all([
      prisma.shopItem.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.shopItem.count({ where }),
    ]);

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
   * 상품 상세 조회
   */
  async getItem(itemId: string) {
    const item = await prisma.shopItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      throw new NotFoundError('상품을 찾을 수 없습니다');
    }

    return item;
  }

  /**
   * 상품 생성 (Admin)
   */
  async createItem(data: {
    title: string;
    description?: string;
    imageUrl?: string;
    pricePoints: number;
    stock: number;
    requiresShipping?: boolean;
  }) {
    const item = await prisma.shopItem.create({
      data: {
        title: data.title,
        description: data.description,
        imageUrl: data.imageUrl,
        pricePoints: data.pricePoints,
        stock: data.stock,
        requiresShipping: data.requiresShipping || false,
        status: ShopItemStatus.ACTIVE,
      },
    });

    return item;
  }

  /**
   * 상품 수정 (Admin)
   */
  async updateItem(
    itemId: string,
    data: {
      title?: string;
      description?: string;
      imageUrl?: string;
      pricePoints?: number;
      stock?: number;
      status?: ShopItemStatus;
      requiresShipping?: boolean;
    }
  ) {
    const item = await prisma.shopItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      throw new NotFoundError('상품을 찾을 수 없습니다');
    }

    const updatedItem = await prisma.shopItem.update({
      where: { id: itemId },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
        ...(data.pricePoints !== undefined && { pricePoints: data.pricePoints }),
        ...(data.stock !== undefined && { stock: data.stock }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.requiresShipping !== undefined && { requiresShipping: data.requiresShipping }),
      },
    });

    return updatedItem;
  }

  /**
   * 교환 주문 생성
   * 멱등성: idempotencyKey로 중복 주문 방지 + PointLedgerTx 유니크로 중복 차감 방지
   */
  async createOrder(
    userId: string,
    data: {
      itemId: string;
      quantity: number;
      shipping?: {
        name: string;
        phone: string;
        address1: string;
        address2?: string;
      };
      memo?: string;
      idempotencyKey?: string;
    }
  ) {
    const { itemId, quantity, shipping, memo, idempotencyKey } = data;

    // 1. 멱등성 체크: 이미 같은 키로 주문이 있으면 반환
    if (idempotencyKey) {
      const existingOrder = await prisma.redemptionOrder.findUnique({
        where: { idempotencyKey },
        include: { item: true },
      });

      if (existingOrder) {
        return {
          success: true,
          alreadyProcessed: true,
          order: existingOrder,
        };
      }
    }

    // 2. 상품 조회 및 검증
    const item = await prisma.shopItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      throw new NotFoundError('상품을 찾을 수 없습니다');
    }

    if (item.status !== ShopItemStatus.ACTIVE) {
      throw new BadRequestError('현재 교환할 수 없는 상품입니다');
    }

    if (item.stock < quantity) {
      throw new ConflictError('재고가 부족합니다');
    }

    // 3. 배송 필요 상품인데 주소가 없으면 에러
    if (item.requiresShipping && !shipping) {
      throw new BadRequestError('배송 정보를 입력해주세요');
    }

    // 4. 총 포인트 계산
    const totalPoints = new Prisma.Decimal(item.pricePoints.toString()).times(quantity);

    // 5. 트랜잭션: 재고 감소 + 주문 생성 + 포인트 차감
    try {
      const order = await prisma.$transaction(async (tx) => {
        // 5-1. 재고 감소 (동시성 안전: stock >= quantity 조건)
        const updated = await tx.shopItem.updateMany({
          where: {
            id: itemId,
            stock: { gte: quantity },
          },
          data: {
            stock: { decrement: quantity },
          },
        });

        if (updated.count === 0) {
          throw new ConflictError('재고가 부족합니다');
        }

        // 5-2. 주문 생성
        const newOrder = await tx.redemptionOrder.create({
          data: {
            userId,
            itemId,
            quantity,
            totalPoints,
            status: RedemptionStatus.REQUESTED,
            idempotencyKey,
            shippingName: shipping?.name,
            shippingPhone: shipping?.phone,
            shippingAddress1: shipping?.address1,
            shippingAddress2: shipping?.address2,
            memo,
          },
          include: { item: true },
        });

        // 5-3. 포인트 차감
        const pointResult = await pointService.adjustPoints(
          userId,
          totalPoints.negated(),
          'REDEEM_GOODS',
          'REDEMPTION_ORDER',
          newOrder.id,
          `포인트 샵 교환: ${item.title} x${quantity} (${totalPoints}P)`
        );

        if (!pointResult.success && !pointResult.alreadyProcessed) {
          throw new BadRequestError('포인트가 부족합니다');
        }

        return newOrder;
      });

      return {
        success: true,
        alreadyProcessed: false,
        order,
      };
    } catch (error: any) {
      // P2002: Unique constraint (idempotencyKey 중복)
      if (error.code === 'P2002' && error.meta?.target?.includes('idempotency_key')) {
        const existingOrder = await prisma.redemptionOrder.findUnique({
          where: { idempotencyKey: idempotencyKey! },
          include: { item: true },
        });

        return {
          success: true,
          alreadyProcessed: true,
          order: existingOrder,
        };
      }

      throw error;
    }
  }

  /**
   * 내 주문 목록 조회
   */
  async getMyOrders(
    userId: string,
    options: { page?: number; pageSize?: number; status?: RedemptionStatus } = {}
  ) {
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.RedemptionOrderWhereInput = {
      userId,
      ...(options.status && { status: options.status }),
    };

    const [orders, total] = await Promise.all([
      prisma.redemptionOrder.findMany({
        where,
        include: { item: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.redemptionOrder.count({ where }),
    ]);

    return {
      orders,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * 주문 취소 (REQUESTED 상태만)
   * 포인트 환불 + 재고 복구
   */
  async cancelOrder(userId: string, orderId: string) {
    const order = await prisma.redemptionOrder.findUnique({
      where: { id: orderId },
      include: { item: true },
    });

    if (!order) {
      throw new NotFoundError('주문을 찾을 수 없습니다');
    }

    if (order.userId !== userId) {
      throw new BadRequestError('본인의 주문만 취소할 수 있습니다');
    }

    if (order.status !== RedemptionStatus.REQUESTED) {
      throw new ConflictError('요청 상태의 주문만 취소할 수 있습니다');
    }

    // 트랜잭션: 주문 취소 + 재고 복구 + 포인트 환불
    await prisma.$transaction(async (tx) => {
      // 1. 주문 상태 변경
      await tx.redemptionOrder.update({
        where: { id: orderId },
        data: {
          status: RedemptionStatus.CANCELED,
          canceledAt: new Date(),
        },
      });

      // 2. 재고 복구
      await tx.shopItem.update({
        where: { id: order.itemId },
        data: {
          stock: { increment: order.quantity },
        },
      });

      // 3. 포인트 환불
      await pointService.adjustPoints(
        userId,
        order.totalPoints,
        'REDEEM_CANCEL_REFUND',
        'REDEMPTION_ORDER',
        orderId,
        `포인트 샵 취소 환불: ${order.item.title} x${order.quantity} (+${order.totalPoints}P)`
      );
    });

    return { success: true };
  }

  /**
   * 관리자: 주문 목록 조회
   */
  async adminListOrders(options: {
    page?: number;
    pageSize?: number;
    status?: RedemptionStatus;
    q?: string;
  } = {}) {
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.RedemptionOrderWhereInput = {
      ...(options.status && { status: options.status }),
      ...(options.q && {
        OR: [
          { item: { title: { contains: options.q, mode: 'insensitive' } } },
          { shippingName: { contains: options.q, mode: 'insensitive' } },
          { shippingPhone: { contains: options.q } },
        ],
      }),
    };

    const [orders, total] = await Promise.all([
      prisma.redemptionOrder.findMany({
        where,
        include: {
          item: true,
          user: {
            select: {
              id: true,
              email: true,
              fan: {
                select: { nickname: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.redemptionOrder.count({ where }),
    ]);

    return {
      orders,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * 관리자: 주문 처리 완료 (REQUESTED -> FULFILLED)
   */
  async adminFulfill(orderId: string, adminId: string, memo?: string) {
    const order = await prisma.redemptionOrder.findUnique({
      where: { id: orderId },
      include: { item: true },
    });

    if (!order) {
      throw new NotFoundError('주문을 찾을 수 없습니다');
    }

    if (order.status !== RedemptionStatus.REQUESTED) {
      throw new ConflictError('요청 상태의 주문만 처리할 수 있습니다');
    }

    // 주문 상태 변경
    const updatedOrder = await prisma.redemptionOrder.update({
      where: { id: orderId },
      data: {
        status: RedemptionStatus.FULFILLED,
        fulfilledAt: new Date(),
        fulfilledBy: adminId,
        ...(memo && { memo }),
      },
      include: { item: true },
    });

    // 감사 로그
    await prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'REDEMPTION_FULFILL',
        entityType: 'REDEMPTION_ORDER',
        entityId: orderId,
        newValue: { status: 'FULFILLED', memo },
      },
    });

    // 사용자에게 알림
    await prisma.notification.create({
      data: {
        userId: order.userId,
        type: 'REDEMPTION_FULFILLED',
        title: '교환 처리 완료',
        message: `"${order.item.title}" 교환이 처리되었습니다`,
        data: { orderId },
      },
    });

    return updatedOrder;
  }
}

export const redemptionService = new RedemptionService();
