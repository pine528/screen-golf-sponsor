/**
 * Admin Finance Actions E2E Tests
 * 운영자 WRITE 액션 테스트
 */

import request from 'supertest';
import { app } from '../src/index';
import prisma from '../src/models/prisma';
import jwt from 'jsonwebtoken';
import config from '../src/config';

// 테스트용 토큰 생성
function createAdminToken(userId: string): string {
  return jwt.sign({ userId, role: 'ADMIN' }, config.jwtSecret, { expiresIn: '1h' });
}

function createBrandToken(userId: string): string {
  return jwt.sign({ userId, role: 'BRAND' }, config.jwtSecret, { expiresIn: '1h' });
}

// 테스트 데이터 셋업
async function setupTestData() {
  // Clean up
  await prisma.adminActionLog.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.ledgerTx.deleteMany({});
  await prisma.escrow.deleteMany({});
  await prisma.wallet.deleteMany({});

  // Create admin user
  const adminUser = await prisma.user.upsert({
    where: { email: 'test-admin@test.com' },
    update: {},
    create: {
      email: 'test-admin@test.com',
      passwordHash: 'hashed',
      role: 'ADMIN',
    },
  });

  await prisma.admin.upsert({
    where: { userId: adminUser.id },
    update: {},
    create: {
      userId: adminUser.id,
      name: 'Test Admin',
    },
  });

  // Create brand user
  const brandUser = await prisma.user.upsert({
    where: { email: 'test-brand@test.com' },
    update: {},
    create: {
      email: 'test-brand@test.com',
      passwordHash: 'hashed',
      role: 'BRAND',
    },
  });

  const brand = await prisma.brand.upsert({
    where: { userId: brandUser.id },
    update: {},
    create: {
      userId: brandUser.id,
      name: 'Test Brand',
      category: 'sports',
      contactEmail: 'brand@test.com',
    },
  });

  // Create athlete user
  const athleteUser = await prisma.user.upsert({
    where: { email: 'test-athlete@test.com' },
    update: {},
    create: {
      email: 'test-athlete@test.com',
      passwordHash: 'hashed',
      role: 'ATHLETE',
    },
  });

  const athlete = await prisma.athlete.upsert({
    where: { userId: athleteUser.id },
    update: {},
    create: {
      userId: athleteUser.id,
      name: 'Test Athlete',
      tour: 'KLPGA',
    },
  });

  // Create wallets
  const brandWallet = await prisma.wallet.create({
    data: {
      ownerType: 'BRAND',
      ownerId: brand.id,
      balance: 10000000, // 1000만원
      frozenAmount: 0,
    },
  });

  await prisma.wallet.create({
    data: {
      ownerType: 'ATHLETE',
      ownerId: athlete.id,
      balance: 0,
      frozenAmount: 0,
    },
  });

  await prisma.wallet.create({
    data: {
      ownerType: 'PLATFORM',
      ownerId: 'PLATFORM',
      balance: 0,
      frozenAmount: 0,
    },
  });

  // Create a test escrow (HELD status)
  const escrow = await prisma.escrow.create({
    data: {
      contractId: 'test-contract-001',
      brandId: brand.id,
      athleteId: athlete.id,
      grossAmount: 1000000,
      platformFee: 100000,
      platformFeeRate: 0.1,
      athletePayout: 900000,
      status: 'HELD',
    },
  });

  // Freeze amount in brand wallet
  await prisma.wallet.update({
    where: { id: brandWallet.id },
    data: {
      balance: { decrement: 1000000 },
      frozenAmount: { increment: 1000000 },
    },
  });

  // Create escrow hold ledger tx
  await prisma.ledgerTx.create({
    data: {
      walletId: brandWallet.id,
      type: 'ESCROW_HOLD',
      amount: -1000000,
      balanceAfter: 9000000,
      status: 'COMPLETED',
      refType: 'CONTRACT',
      refId: 'test-contract-001',
    },
  });

  return { adminUser, brandUser, brand, athlete, escrow };
}

describe('Admin Finance Actions', () => {
  let testData: Awaited<ReturnType<typeof setupTestData>>;
  let adminToken: string;
  let brandToken: string;

  beforeAll(async () => {
    testData = await setupTestData();
    adminToken = createAdminToken(testData.adminUser.id);
    brandToken = createBrandToken(testData.brandUser.id);
  });

  afterAll(async () => {
    // Cleanup
    await prisma.adminActionLog.deleteMany({});
    await prisma.notification.deleteMany({});
    await prisma.ledgerTx.deleteMany({});
    await prisma.escrow.deleteMany({});
  });

  describe('POST /api/admin/finance/escrows/:id/release', () => {
    it('should reject if not admin', async () => {
      const res = await request(app)
        .post(`/api/admin/finance/escrows/${testData.escrow.id}/release`)
        .set('Authorization', `Bearer ${brandToken}`)
        .send({
          reason: 'Test release reason for testing purposes',
          confirmText: 'RELEASE',
        });

      expect(res.status).toBe(403);
    });

    it('should reject if reason is too short', async () => {
      const res = await request(app)
        .post(`/api/admin/finance/escrows/${testData.escrow.id}/release`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reason: 'short',
          confirmText: 'RELEASE',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_REASON');
    });

    it('should reject if confirmText is wrong', async () => {
      const res = await request(app)
        .post(`/api/admin/finance/escrows/${testData.escrow.id}/release`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reason: 'Test release reason for testing purposes',
          confirmText: 'WRONG',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('CONFIRM_MISMATCH');
    });

    it('should release escrow successfully', async () => {
      const res = await request(app)
        .post(`/api/admin/finance/escrows/${testData.escrow.id}/release`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reason: 'Test release reason for testing purposes',
          confirmText: 'RELEASE',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ok).toBe(true);
      expect(res.body.data.alreadyProcessed).toBe(false);

      // Verify escrow status changed
      const escrow = await prisma.escrow.findUnique({
        where: { id: testData.escrow.id },
      });
      expect(escrow?.status).toBe('RELEASED');

      // Verify athlete wallet credited
      const athleteWallet = await prisma.wallet.findFirst({
        where: { ownerType: 'ATHLETE', ownerId: testData.athlete.id },
      });
      expect(athleteWallet?.balance.toNumber()).toBe(900000);

      // Verify platform wallet credited
      const platformWallet = await prisma.wallet.findFirst({
        where: { ownerType: 'PLATFORM', ownerId: 'PLATFORM' },
      });
      expect(platformWallet?.balance.toNumber()).toBe(100000);

      // Verify admin action log created
      const actionLog = await prisma.adminActionLog.findFirst({
        where: { targetId: testData.escrow.id, action: 'ESCROW_RELEASE_MANUAL' },
      });
      expect(actionLog).not.toBeNull();
      expect(actionLog?.reason).toBe('Test release reason for testing purposes');
    });

    it('should return alreadyProcessed on second release attempt', async () => {
      const res = await request(app)
        .post(`/api/admin/finance/escrows/${testData.escrow.id}/release`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reason: 'Second release attempt should be idempotent',
          confirmText: 'RELEASE',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.alreadyProcessed).toBe(true);

      // Verify no double credit
      const athleteWallet = await prisma.wallet.findFirst({
        where: { ownerType: 'ATHLETE', ownerId: testData.athlete.id },
      });
      expect(athleteWallet?.balance.toNumber()).toBe(900000); // Still 900000
    });
  });

  describe('POST /api/admin/finance/escrows/:id/refund', () => {
    let refundEscrow: any;

    beforeAll(async () => {
      // Create a new HELD escrow for refund test
      const brandWallet = await prisma.wallet.findFirst({
        where: { ownerType: 'BRAND', ownerId: testData.brand.id },
      });

      // Add more balance for new escrow
      await prisma.wallet.update({
        where: { id: brandWallet!.id },
        data: {
          balance: { decrement: 500000 },
          frozenAmount: { increment: 500000 },
        },
      });

      refundEscrow = await prisma.escrow.create({
        data: {
          contractId: 'test-contract-002',
          brandId: testData.brand.id,
          athleteId: testData.athlete.id,
          grossAmount: 500000,
          platformFee: 50000,
          platformFeeRate: 0.1,
          athletePayout: 450000,
          status: 'HELD',
        },
      });
    });

    it('should refund escrow successfully', async () => {
      const res = await request(app)
        .post(`/api/admin/finance/escrows/${refundEscrow.id}/refund`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reason: 'Customer requested refund due to contract dispute',
          confirmText: 'REFUND',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ok).toBe(true);
      expect(res.body.data.alreadyProcessed).toBe(false);

      // Verify escrow status
      const escrow = await prisma.escrow.findUnique({
        where: { id: refundEscrow.id },
      });
      expect(escrow?.status).toBe('REFUNDED');
    });

    it('should return alreadyProcessed on second refund attempt', async () => {
      const res = await request(app)
        .post(`/api/admin/finance/escrows/${refundEscrow.id}/refund`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reason: 'Second refund attempt should be idempotent',
          confirmText: 'REFUND',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.alreadyProcessed).toBe(true);
    });
  });

  describe('POST /api/admin/finance/contracts/:id/cancel', () => {
    let cancelContract: any;
    let cancelEscrow: any;

    beforeAll(async () => {
      // Create test event
      const event = await prisma.event.upsert({
        where: { id: 'test-event-001' },
        update: {},
        create: {
          id: 'test-event-001',
          tour: 'KLPGA',
          name: 'Test Event',
          dateStart: new Date(),
          dateEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      // Create slot template
      const slotTemplate = await prisma.slotTemplate.upsert({
        where: { code: 'TEST-SLOT' },
        update: {},
        create: {
          code: 'TEST-SLOT',
          name: 'Test Slot',
          bodyPart: 'SHIRT_CHEST_LEFT',
          sizeMaxWMm: 100,
          sizeMaxHMm: 100,
          perimeterMaxMm: 400,
        },
      });

      // Create slot instance
      const slotInstance = await prisma.slotInstance.create({
        data: {
          eventId: event.id,
          athleteId: testData.athlete.id,
          slotTemplateId: slotTemplate.id,
          reservePrice: 100000,
        },
      });

      // Create auction
      const auction = await prisma.auction.create({
        data: {
          slotInstanceId: slotInstance.id,
          startAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
          endAt: new Date(Date.now() - 1000),
          originalEndAt: new Date(Date.now() - 1000),
          status: 'ENDED',
          currentPrice: 300000,
        },
      });

      // Create contract
      cancelContract = await prisma.contract.create({
        data: {
          auctionId: auction.id,
          brandId: testData.brand.id,
          athleteId: testData.athlete.id,
          priceFinal: 300000,
          status: 'ACTIVE',
          brandSignedAt: new Date(),
          athleteSignedAt: new Date(),
          signedAt: new Date(),
        },
      });

      // Create escrow for this contract
      const brandWallet = await prisma.wallet.findFirst({
        where: { ownerType: 'BRAND', ownerId: testData.brand.id },
      });

      await prisma.wallet.update({
        where: { id: brandWallet!.id },
        data: {
          balance: { decrement: 300000 },
          frozenAmount: { increment: 300000 },
        },
      });

      cancelEscrow = await prisma.escrow.create({
        data: {
          contractId: cancelContract.id,
          brandId: testData.brand.id,
          athleteId: testData.athlete.id,
          grossAmount: 300000,
          platformFee: 30000,
          platformFeeRate: 0.1,
          athletePayout: 270000,
          status: 'HELD',
        },
      });
    });

    it('should cancel contract and refund escrow', async () => {
      const res = await request(app)
        .post(`/api/admin/finance/contracts/${cancelContract.id}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reason: 'Contract cancelled due to policy violation',
          confirmText: 'CANCEL',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ok).toBe(true);
      expect(res.body.data.escrowRefunded).toBe(true);

      // Verify contract status
      const contract = await prisma.contract.findUnique({
        where: { id: cancelContract.id },
      });
      expect(contract?.status).toBe('CANCELLED');

      // Verify escrow refunded
      const escrow = await prisma.escrow.findUnique({
        where: { id: cancelEscrow.id },
      });
      expect(escrow?.status).toBe('REFUNDED');
    });

    it('should return alreadyProcessed on second cancel attempt', async () => {
      const res = await request(app)
        .post(`/api/admin/finance/contracts/${cancelContract.id}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reason: 'Second cancel attempt should be idempotent',
          confirmText: 'CANCEL',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.alreadyProcessed).toBe(true);
    });
  });

  describe('Idempotency with same key', () => {
    let idempotentEscrow: any;

    beforeAll(async () => {
      const brandWallet = await prisma.wallet.findFirst({
        where: { ownerType: 'BRAND', ownerId: testData.brand.id },
      });

      await prisma.wallet.update({
        where: { id: brandWallet!.id },
        data: {
          balance: { decrement: 200000 },
          frozenAmount: { increment: 200000 },
        },
      });

      idempotentEscrow = await prisma.escrow.create({
        data: {
          contractId: 'test-contract-idem',
          brandId: testData.brand.id,
          athleteId: testData.athlete.id,
          grossAmount: 200000,
          platformFee: 20000,
          platformFeeRate: 0.1,
          athletePayout: 180000,
          status: 'HELD',
        },
      });
    });

    it('should handle idempotency key correctly', async () => {
      const idempotencyKey = 'unique-release-key-123';

      // First request
      const res1 = await request(app)
        .post(`/api/admin/finance/escrows/${idempotentEscrow.id}/release`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-Idempotency-Key', idempotencyKey)
        .send({
          reason: 'First release with idempotency key',
          confirmText: 'RELEASE',
        });

      expect(res1.status).toBe(200);
      expect(res1.body.data.alreadyProcessed).toBe(false);

      // Second request with same key should return cached result
      const res2 = await request(app)
        .post(`/api/admin/finance/escrows/${idempotentEscrow.id}/release`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-Idempotency-Key', idempotencyKey)
        .send({
          reason: 'Second release with same idempotency key',
          confirmText: 'RELEASE',
        });

      expect(res2.status).toBe(200);
      expect(res2.body.data.alreadyProcessed).toBe(true);
    });
  });
});
