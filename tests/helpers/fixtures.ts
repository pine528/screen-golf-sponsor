/**
 * 테스트용 Fixture 생성 헬퍼
 * 에스크로/계약 테스트에 필요한 데이터를 빠르게 생성
 */

import prisma from '../../src/models/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Decimal } from '@prisma/client/runtime/library';

const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-minimum-32-characters-long';

export interface TestUser {
  id: string;
  email: string;
  password: string;
  token: string;
}

export interface TestBrand {
  user: TestUser;
  brandId: string;
}

export interface TestAthlete {
  user: TestUser;
  athleteId: string;
}

export interface TestAdmin {
  user: TestUser;
}

export interface TestContractSetup {
  brand: TestBrand;
  athlete: TestAthlete;
  admin: TestAdmin;
  eventId: string;
  slotTemplateId: string;
  slotInstanceId: string;
  auctionId: string;
  contractId: string;
  priceFinal: number;
}

/**
 * 테스트용 사용자 생성
 */
export async function createTestUser(
  role: 'BRAND' | 'ATHLETE' | 'ADMIN',
  suffix: string = ''
): Promise<TestUser> {
  const email = `test-${role.toLowerCase()}${suffix}@test.com`;
  const password = 'Test1234!';
  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: hashedPassword,
      role,
      isVerified: true,
    },
  });

  const token = jwt.sign(
    { userId: user.id, role: user.role },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  return { id: user.id, email, password, token };
}

/**
 * 테스트용 브랜드 생성 (지갑 포함)
 */
export async function createTestBrand(
  initialBalance: number = 10000000,
  suffix: string = ''
): Promise<TestBrand> {
  const user = await createTestUser('BRAND', suffix);

  const brand = await prisma.brand.create({
    data: {
      userId: user.id,
      name: `테스트브랜드${suffix}`,
      businessNumber: `123-45-6789${suffix.slice(0, 1) || '0'}`,
      category: 'GOLF_EQUIPMENT',
      contactName: '테스트담당자',
      contactPhone: '010-1234-5678',
      contactEmail: user.email,
    },
  });

  // 브랜드 지갑 생성 및 초기 잔액 설정
  await prisma.wallet.create({
    data: {
      ownerType: 'BRAND',
      ownerId: brand.id,
      balance: new Decimal(initialBalance),
      frozenAmount: new Decimal(0),
    },
  });

  return { user, brandId: brand.id };
}

/**
 * 테스트용 선수 생성 (지갑 포함)
 */
export async function createTestAthlete(suffix: string = ''): Promise<TestAthlete> {
  const user = await createTestUser('ATHLETE', suffix);

  const athlete = await prisma.athlete.create({
    data: {
      userId: user.id,
      name: `테스트선수${suffix}`,
      tour: 'KPGA',
      worldRank: 100,
      koreaRank: 50,
      profileImageUrl: 'https://example.com/profile.jpg',
    },
  });

  // 선수 지갑 생성
  await prisma.wallet.create({
    data: {
      ownerType: 'ATHLETE',
      ownerId: athlete.id,
      balance: new Decimal(0),
      frozenAmount: new Decimal(0),
    },
  });

  return { user, athleteId: athlete.id };
}

/**
 * 테스트용 관리자 생성
 */
export async function createTestAdmin(suffix: string = ''): Promise<TestAdmin> {
  const user = await createTestUser('ADMIN', suffix);
  return { user };
}

/**
 * 플랫폼 지갑 생성 (없으면)
 */
export async function ensurePlatformWallet(): Promise<void> {
  await prisma.wallet.upsert({
    where: {
      ownerType_ownerId: { ownerType: 'PLATFORM', ownerId: 'SYSTEM' },
    },
    create: {
      ownerType: 'PLATFORM',
      ownerId: 'SYSTEM',
      balance: new Decimal(0),
      frozenAmount: new Decimal(0),
    },
    update: {},
  });
}

/**
 * 테스트용 이벤트 + 슬롯템플릿 + 슬롯인스턴스 생성
 */
export async function createTestEvent(athleteId: string): Promise<{
  eventId: string;
  slotTemplateId: string;
  slotInstanceId: string;
}> {
  const event = await prisma.event.create({
    data: {
      name: '테스트 골프대회',
      startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7일 후
      endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10일 후
      location: '테스트 골프장',
      description: '테스트용 대회입니다.',
    },
  });

  const slotTemplate = await prisma.slotTemplate.create({
    data: {
      name: '모자 정면',
      category: 'HAT',
      position: 'FRONT',
      sizeCm: '5x3',
      guidelineImageUrl: 'https://example.com/guideline.jpg',
    },
  });

  const slotInstance = await prisma.slotInstance.create({
    data: {
      eventId: event.id,
      athleteId,
      slotTemplateId: slotTemplate.id,
      status: 'OPEN',
      basePrice: 500000,
    },
  });

  return {
    eventId: event.id,
    slotTemplateId: slotTemplate.id,
    slotInstanceId: slotInstance.id,
  };
}

/**
 * 테스트용 경매 생성 (ENDED 상태 + 낙찰자 있음)
 */
export async function createTestAuction(
  slotInstanceId: string,
  brandId: string,
  winningPrice: number = 1000000
): Promise<string> {
  const auction = await prisma.auction.create({
    data: {
      slotInstanceId,
      startTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2시간 전 시작
      endTime: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1시간 전 종료
      startPrice: 500000,
      currentPrice: winningPrice,
      bidIncrement: 10000,
      status: 'ENDED',
    },
  });

  // 낙찰 입찰 생성
  await prisma.bid.create({
    data: {
      auctionId: auction.id,
      brandId,
      amount: winningPrice,
      isWinning: true,
    },
  });

  // 슬롯 상태 업데이트
  await prisma.slotInstance.update({
    where: { id: slotInstanceId },
    data: { status: 'SOLD' },
  });

  return auction.id;
}

/**
 * 테스트용 계약 생성 (양측 서명 대기 상태)
 */
export async function createTestContract(
  auctionId: string,
  brandId: string,
  athleteId: string,
  priceFinal: number = 1000000
): Promise<string> {
  const contract = await prisma.contract.create({
    data: {
      auctionId,
      brandId,
      athleteId,
      priceFinal,
      status: 'PENDING_SIGNATURE',
      assetDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  return contract.id;
}

/**
 * 전체 테스트 시나리오 셋업: 계약 서명 대기 상태까지
 */
export async function setupContractScenario(
  brandBalance: number = 10000000,
  contractPrice: number = 1000000
): Promise<TestContractSetup> {
  await ensurePlatformWallet();

  const brand = await createTestBrand(brandBalance);
  const athlete = await createTestAthlete();
  const admin = await createTestAdmin();

  const { eventId, slotTemplateId, slotInstanceId } = await createTestEvent(athlete.athleteId);
  const auctionId = await createTestAuction(slotInstanceId, brand.brandId, contractPrice);
  const contractId = await createTestContract(auctionId, brand.brandId, athlete.athleteId, contractPrice);

  return {
    brand,
    athlete,
    admin,
    eventId,
    slotTemplateId,
    slotInstanceId,
    auctionId,
    contractId,
    priceFinal: contractPrice,
  };
}

/**
 * 계약 양측 서명 완료 처리 (에스크로 홀드 트리거)
 */
export async function signContractBothSides(contractId: string): Promise<void> {
  const now = new Date();
  await prisma.contract.update({
    where: { id: contractId },
    data: {
      brandSignedAt: now,
      athleteSignedAt: now,
      signedAt: now,
      status: 'ASSET_PENDING',
    },
  });
}

/**
 * 에셋 제출 및 승인 처리
 */
export async function submitAndApproveAsset(contractId: string, reviewerId: string): Promise<string> {
  const asset = await prisma.creativeAsset.create({
    data: {
      contractId,
      fileUrl: 'https://example.com/asset.png',
      fileName: 'test-asset.png',
      fileType: 'image/png',
      status: 'APPROVED',
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
    },
  });

  await prisma.contract.update({
    where: { id: contractId },
    data: { status: 'ASSET_APPROVED' },
  });

  return asset.id;
}

/**
 * 노출 인증 제출 처리
 */
export async function submitVerification(contractId: string): Promise<string> {
  const verification = await prisma.verification.create({
    data: {
      contractId,
      photoUrls: ['https://example.com/photo1.jpg', 'https://example.com/photo2.jpg'],
      angles: ['FRONT', 'SIDE'],
      status: 'SUBMITTED',
    },
  });

  await prisma.contract.update({
    where: { id: contractId },
    data: { status: 'VERIFICATION_PENDING' },
  });

  return verification.id;
}
