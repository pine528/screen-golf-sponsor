/**
 * FAQ Service
 *
 * 고객지원 FAQ 관리
 * - 공개 API: FAQ 목록 조회, 검색, 상세 조회 (viewCount 증가)
 * - Admin API: CRUD, 순서 변경, 발행 상태 토글
 */

import prisma from '../models/prisma';
import { FaqCategory, FaqItem, Prisma } from '@prisma/client';

interface CreateFaqData {
  category: FaqCategory;
  question: string;
  answer: string;
  orderIndex?: number;
  isPublished?: boolean;
}

interface UpdateFaqData {
  category?: FaqCategory;
  question?: string;
  answer?: string;
  orderIndex?: number;
  isPublished?: boolean;
}

interface FaqFilters {
  category?: FaqCategory;
  isPublished?: boolean;
  q?: string;
}

interface CategoryCount {
  category: FaqCategory;
  count: number;
}

class FaqService {
  // ============================================
  // Public API
  // ============================================

  /**
   * 공개 FAQ 목록 조회
   */
  async getPublishedFaqs(category?: FaqCategory): Promise<FaqItem[]> {
    const where: Prisma.FaqItemWhereInput = {
      isPublished: true,
    };

    if (category) {
      where.category = category;
    }

    return prisma.faqItem.findMany({
      where,
      orderBy: [{ category: 'asc' }, { orderIndex: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /**
   * FAQ 카테고리별 개수 조회
   */
  async getCategories(): Promise<CategoryCount[]> {
    const result = await prisma.faqItem.groupBy({
      by: ['category'],
      where: { isPublished: true },
      _count: { id: true },
    });

    return result.map((r) => ({
      category: r.category,
      count: r._count.id,
    }));
  }

  /**
   * FAQ 검색
   */
  async searchFaqs(query: string): Promise<FaqItem[]> {
    if (!query || query.trim().length < 2) {
      return [];
    }

    const searchTerm = query.trim();

    return prisma.faqItem.findMany({
      where: {
        isPublished: true,
        OR: [
          { question: { contains: searchTerm, mode: 'insensitive' } },
          { answer: { contains: searchTerm, mode: 'insensitive' } },
        ],
      },
      orderBy: [{ category: 'asc' }, { orderIndex: 'asc' }],
      take: 20,
    });
  }

  /**
   * FAQ 상세 조회 (viewCount 증가)
   */
  async getFaq(id: string, incrementView: boolean = true): Promise<FaqItem | null> {
    const faq = await prisma.faqItem.findUnique({
      where: { id },
    });

    if (faq && incrementView) {
      await prisma.faqItem.update({
        where: { id },
        data: { viewCount: { increment: 1 } },
      });
    }

    return faq;
  }

  // ============================================
  // Admin API
  // ============================================

  /**
   * Admin: 전체 FAQ 목록 조회 (비발행 포함)
   */
  async getAllFaqs(filters?: FaqFilters): Promise<FaqItem[]> {
    const where: Prisma.FaqItemWhereInput = {};

    if (filters?.category) {
      where.category = filters.category;
    }

    if (filters?.isPublished !== undefined) {
      where.isPublished = filters.isPublished;
    }

    if (filters?.q) {
      where.OR = [
        { question: { contains: filters.q, mode: 'insensitive' } },
        { answer: { contains: filters.q, mode: 'insensitive' } },
      ];
    }

    return prisma.faqItem.findMany({
      where,
      orderBy: [{ category: 'asc' }, { orderIndex: 'asc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Admin: FAQ 생성
   */
  async createFaq(adminId: string, data: CreateFaqData): Promise<FaqItem> {
    // 같은 카테고리 내 최대 orderIndex + 1
    const maxOrder = await prisma.faqItem.aggregate({
      where: { category: data.category },
      _max: { orderIndex: true },
    });

    const orderIndex = data.orderIndex ?? ((maxOrder._max.orderIndex ?? -1) + 1);

    return prisma.faqItem.create({
      data: {
        category: data.category,
        question: data.question,
        answer: data.answer,
        orderIndex,
        isPublished: data.isPublished ?? true,
        createdBy: adminId,
      },
    });
  }

  /**
   * Admin: FAQ 수정
   */
  async updateFaq(id: string, adminId: string, data: UpdateFaqData): Promise<FaqItem> {
    return prisma.faqItem.update({
      where: { id },
      data: {
        ...data,
        updatedBy: adminId,
      },
    });
  }

  /**
   * Admin: FAQ 삭제
   */
  async deleteFaq(id: string): Promise<void> {
    await prisma.faqItem.delete({
      where: { id },
    });
  }

  /**
   * Admin: 발행 상태 토글
   */
  async togglePublish(id: string, adminId: string): Promise<FaqItem> {
    const faq = await prisma.faqItem.findUnique({ where: { id } });
    if (!faq) {
      throw new Error('FAQ not found');
    }

    return prisma.faqItem.update({
      where: { id },
      data: {
        isPublished: !faq.isPublished,
        updatedBy: adminId,
      },
    });
  }

  /**
   * Admin: FAQ 순서 재정렬
   */
  async reorderFaqs(category: FaqCategory, orderedIds: string[]): Promise<void> {
    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.faqItem.update({
          where: { id },
          data: { orderIndex: index },
        })
      )
    );
  }
}

export const faqService = new FaqService();
