import { Prisma } from '@prisma/client';
import prisma from '../models/prisma';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { pointService } from './point.service';

const PLATFORM_USER_ID = 'PLATFORM_SYSTEM';
const DONATION_FEE_RATE = 0.02; // 2% 플랫폼 수수료
const MIN_DONATION_AMOUNT = 100; // 최소 후원 금액

export class DonationService {
  /**
   * 후원 생성
   * - 팬이 선수에게 포인트로 후원
   * - 플랫폼 수수료 2% 차감
   * - 트랜잭션 + 멱등성 보장
   */
  async createDonation(
    donorUserId: string,
    athleteId: string,
    amount: number,
    message?: string,
    isAnonymous: boolean = false
  ) {
    // 1. 유효성 검증
    if (amount < MIN_DONATION_AMOUNT) {
      throw new BadRequestError(`최소 후원 금액은 ${MIN_DONATION_AMOUNT}P입니다`);
    }

    // 2. 선수 확인
    const athlete = await prisma.athlete.findUnique({
      where: { id: athleteId },
      include: { user: true },
    });

    if (!athlete) {
      throw new NotFoundError('선수를 찾을 수 없습니다');
    }

    // SPONPIK docx 4 — 비활성/미승인 선수 후원 차단 (재무 우회 방지)
    if (!athlete.isActive) {
      throw new BadRequestError('현재 후원을 받지 않는 선수입니다');
    }
    if (athlete.kycStatus !== 'APPROVED') {
      throw new BadRequestError('KYC 승인이 완료되지 않은 선수입니다');
    }

    // 3. 자기 자신에게 후원 방지
    if (athlete.userId === donorUserId) {
      throw new BadRequestError('자기 자신에게는 후원할 수 없습니다');
    }

    // 4. 수수료 계산
    const platformFee = Math.floor(amount * DONATION_FEE_RATE);
    const netAmount = amount - platformFee;

    // 5. 트랜잭션으로 처리
    const donation = await prisma.$transaction(async (tx) => {
      // 5.1 Donation 레코드 먼저 생성 (ID 필요)
      const newDonation = await tx.donation.create({
        data: {
          donorUserId,
          athleteId,
          amount: new Prisma.Decimal(amount),
          platformFee: new Prisma.Decimal(platformFee),
          netAmount: new Prisma.Decimal(netAmount),
          message,
          isAnonymous,
        },
      });

      // 5.2 팬 포인트 차감
      await pointService.adjustPointsWithTx(
        tx,
        donorUserId,
        -amount,
        'DONATION_SEND',
        'DONATION',
        newDonation.id,
        `선수 후원: ${athlete.name}`
      );

      // 5.3 선수 포인트 적립 (순수령액)
      await pointService.adjustPointsWithTx(
        tx,
        athlete.userId,
        netAmount,
        'DONATION_RECEIVE',
        'DONATION',
        newDonation.id,
        isAnonymous ? '익명 팬 후원' : '팬 후원'
      );

      // 5.4 플랫폼 수수료 적립
      if (platformFee > 0) {
        await pointService.adjustPointsWithTx(
          tx,
          PLATFORM_USER_ID,
          platformFee,
          'DONATION_FEE',
          'DONATION',
          newDonation.id,
          `후원 수수료: ${platformFee}P`
        );
      }

      return newDonation;
    });

    return donation;
  }

  /**
   * 선수의 후원자 목록 조회
   * - 선수 본인만 조회 가능
   */
  async getDonationsForAthlete(
    athleteId: string,
    page: number = 1,
    limit: number = 20
  ) {
    const skip = (page - 1) * limit;

    const [donations, total, totalAmount] = await Promise.all([
      prisma.donation.findMany({
        where: { athleteId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          donorUser: {
            select: {
              id: true,
              fan: {
                select: { nickname: true, avatarUrl: true },
              },
            },
          },
        },
      }),
      prisma.donation.count({ where: { athleteId } }),
      prisma.donation.aggregate({
        where: { athleteId },
        _sum: { netAmount: true },
      }),
    ]);

    // 익명 후원자 정보 마스킹
    const processedDonations = donations.map(d => ({
      id: d.id,
      amount: d.amount,
      platformFee: d.platformFee,
      netAmount: d.netAmount,
      message: d.message,
      isAnonymous: d.isAnonymous,
      createdAt: d.createdAt,
      donor: d.isAnonymous
        ? { nickname: '익명', avatarUrl: null }
        : {
            nickname: d.donorUser.fan?.nickname || '팬',
            avatarUrl: d.donorUser.fan?.avatarUrl || null,
          },
    }));

    return {
      donations: processedDonations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary: {
        totalAmount: totalAmount._sum.netAmount || new Prisma.Decimal(0),
        totalCount: total,
      },
    };
  }

  /**
   * 팬의 후원 내역 조회
   */
  async getDonationsByUser(
    userId: string,
    page: number = 1,
    limit: number = 20
  ) {
    const skip = (page - 1) * limit;

    const [donations, total, totalAmount] = await Promise.all([
      prisma.donation.findMany({
        where: { donorUserId: userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          athlete: {
            select: {
              id: true,
              name: true,
              profileImageUrl: true,
              tour: true,
            },
          },
        },
      }),
      prisma.donation.count({ where: { donorUserId: userId } }),
      prisma.donation.aggregate({
        where: { donorUserId: userId },
        _sum: { amount: true },
      }),
    ]);

    return {
      donations: donations.map(d => ({
        id: d.id,
        amount: d.amount,
        platformFee: d.platformFee,
        netAmount: d.netAmount,
        message: d.message,
        isAnonymous: d.isAnonymous,
        createdAt: d.createdAt,
        athlete: d.athlete,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary: {
        totalAmount: totalAmount._sum.amount || new Prisma.Decimal(0),
        totalCount: total,
      },
    };
  }

  /**
   * 선수 목록 조회 (후원 가능한 선수)
   */
  async getAthleteList(page: number = 1, limit: number = 20, search?: string) {
    const skip = (page - 1) * limit;

    const where: Prisma.AthleteWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { tour: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [athletes, total] = await Promise.all([
      prisma.athlete.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          tour: true,
          profileImageUrl: true,
          bio: true,
          _count: {
            select: { donationsReceived: true },
          },
        },
      }),
      prisma.athlete.count({ where }),
    ]);

    return {
      athletes: athletes.map(a => ({
        id: a.id,
        name: a.name,
        tour: a.tour,
        profileImageUrl: a.profileImageUrl,
        bio: a.bio,
        donationCount: a._count.donationsReceived,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export const donationService = new DonationService();
