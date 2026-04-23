/**
 * Mini Store Service
 *
 * - 브랜드 미니스토어 CRUD (캠페인당 1개)
 * - slug 기반 공개 조회 (/store/brand/:slug)
 * - 상품 추가/순서/품절 관리
 * - 게시/비게시 전환
 *
 * Refs:
 * - api_spec.docx > 4-1. 트래킹 자산 생성 > brand_mini_store_url
 * - wireframe_spec.docx > ADM-04, STO-01, STO-02
 * - handoff.docx > MVP 핵심: 스폰픽 내부 미니스토어 중심
 */

import prisma from '../models/prisma';
import { Prisma, MiniStoreStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { customAlphabet } from 'nanoid';
import { NotFoundError, BadRequestError, ConflictError } from '../utils/errors';

const slugRandom = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 6);

export interface CreateStoreParams {
  campaignId: string;
  brandId: string;
  slug?: string;
  template?: string;
  heroImageUrl?: string;
  athleteImageUrl?: string;
  mainCopy?: string;
  benefitBadge?: string;
  ctaText?: string;
}

export interface AddProductParams {
  storeId: string;
  name: string;
  description?: string;
  imageUrl?: string;
  price: number;
  discountPrice?: number;
  stock?: number;
  sortOrder?: number;
}

export class MiniStoreService {
  /**
   * 충돌 없는 slug 생성
   */
  private async newSlug(prefix?: string): Promise<string> {
    for (let i = 0; i < 5; i++) {
      const base = prefix ? prefix.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) : '';
      const slug = base ? `${base}-${slugRandom()}` : slugRandom();
      const exists = await prisma.miniStore.findUnique({ where: { slug } });
      if (!exists) return slug;
    }
    throw new Error('Failed to generate unique slug');
  }

  /**
   * 미니스토어 생성 (idempotent: 캠페인당 1개)
   */
  async create(params: CreateStoreParams, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    const { campaignId, brandId, slug: customSlug } = params;

    // 기존 있으면 반환 (멱등)
    const existing = await client.miniStore.findUnique({ where: { campaignId } });
    if (existing) return existing;

    // brand 정보로 slug prefix 만들기
    const brand = await client.brand.findUnique({ where: { id: brandId }, select: { name: true } });
    const slug = customSlug || await this.newSlug(brand?.name);

    return client.miniStore.create({
      data: {
        campaignId,
        brandId,
        slug,
        template: params.template || 'default-v1',
        heroImageUrl: params.heroImageUrl,
        athleteImageUrl: params.athleteImageUrl,
        mainCopy: params.mainCopy,
        benefitBadge: params.benefitBadge,
        ctaText: params.ctaText || '구매하기',
        status: 'DRAFT',
      },
    });
  }

  /**
   * 캠페인 ID로 조회
   */
  async getByCampaign(campaignId: string, includeProducts = false) {
    return prisma.miniStore.findUnique({
      where: { campaignId },
      include: includeProducts ? { products: { orderBy: { sortOrder: 'asc' } } } : undefined,
    });
  }

  /**
   * 공개 slug로 조회 (게시 상태만)
   */
  async getPublicBySlug(slug: string) {
    const store = await prisma.miniStore.findFirst({
      where: { slug, status: 'PUBLISHED' },
      include: {
        products: { orderBy: { sortOrder: 'asc' } },
        brand: { select: { id: true, name: true, category: true, website: true } },
        campaign: { select: { id: true, name: true, dateEnd: true } },
      },
    });
    if (!store) throw new NotFoundError('Mini store not found or not published');
    return store;
  }

  /**
   * 미니스토어 업데이트
   */
  async update(campaignId: string, data: Partial<CreateStoreParams>) {
    const store = await prisma.miniStore.findUnique({ where: { campaignId } });
    if (!store) throw new NotFoundError('Mini store not found');
    return prisma.miniStore.update({
      where: { campaignId },
      data: {
        template: data.template,
        heroImageUrl: data.heroImageUrl,
        athleteImageUrl: data.athleteImageUrl,
        mainCopy: data.mainCopy,
        benefitBadge: data.benefitBadge,
        ctaText: data.ctaText,
      },
    });
  }

  /**
   * 게시 상태 전환
   */
  async setStatus(campaignId: string, status: MiniStoreStatus) {
    const store = await prisma.miniStore.findUnique({ where: { campaignId } });
    if (!store) throw new NotFoundError('Mini store not found');
    return prisma.miniStore.update({
      where: { campaignId },
      data: {
        status,
        publishedAt: status === 'PUBLISHED' ? new Date() : store.publishedAt,
      },
    });
  }

  /**
   * 상품 추가
   */
  async addProduct(params: AddProductParams) {
    const store = await prisma.miniStore.findUnique({ where: { id: params.storeId } });
    if (!store) throw new NotFoundError('Mini store not found');

    return prisma.storeProduct.create({
      data: {
        storeId: params.storeId,
        name: params.name,
        description: params.description,
        imageUrl: params.imageUrl,
        price: new Decimal(params.price),
        discountPrice: params.discountPrice ? new Decimal(params.discountPrice) : null,
        stock: params.stock ?? 0,
        soldOut: (params.stock ?? 0) <= 0,
        sortOrder: params.sortOrder ?? 0,
      },
    });
  }

  /**
   * 상품 업데이트
   */
  async updateProduct(productId: string, data: Partial<AddProductParams>) {
    return prisma.storeProduct.update({
      where: { id: productId },
      data: {
        name: data.name,
        description: data.description,
        imageUrl: data.imageUrl,
        price: data.price !== undefined ? new Decimal(data.price) : undefined,
        discountPrice: data.discountPrice !== undefined ? new Decimal(data.discountPrice) : undefined,
        stock: data.stock,
        soldOut: data.stock !== undefined ? data.stock <= 0 : undefined,
        sortOrder: data.sortOrder,
      },
    });
  }

  /**
   * 상품 삭제
   */
  async deleteProduct(productId: string) {
    return prisma.storeProduct.delete({ where: { id: productId } });
  }

  /**
   * 재고 차감 (구매 트랜잭션 내에서 호출)
   */
  async decrementStock(productId: string, qty: number, tx: Prisma.TransactionClient) {
    const product = await tx.storeProduct.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundError('Product not found');
    if (product.stock < qty) throw new BadRequestError('Insufficient stock');

    return tx.storeProduct.update({
      where: { id: productId },
      data: {
        stock: { decrement: qty },
        soldOut: product.stock - qty <= 0,
      },
    });
  }
}

export const miniStoreService = new MiniStoreService();
