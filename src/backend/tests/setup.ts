import prisma from '../src/models/prisma';

// 테스트 전 DB 연결 확인
beforeAll(async () => {
  try {
    await prisma.$connect();
    console.log('[Test Setup] Database connected');
  } catch (error) {
    console.error('[Test Setup] Database connection failed:', error);
    throw error;
  }
});

// 테스트 후 DB 연결 종료
afterAll(async () => {
  await prisma.$disconnect();
  console.log('[Test Teardown] Database disconnected');
});

// 각 테스트 전에 테이블 truncate (순서 중요: FK 의존성)
beforeEach(async () => {
  // 테스트 격리를 위해 관련 테이블만 truncate
  // cascade 옵션으로 FK 제약 해결
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "LedgerTx",
      "PayoutItem",
      "PayoutBatch",
      "Escrow",
      "Verification",
      "CreativeAsset",
      "Contract",
      "Bid",
      "Auction",
      "SlotInstance",
      "SlotTemplate",
      "Event",
      "Notification",
      "Wallet"
    RESTART IDENTITY CASCADE
  `);
});
