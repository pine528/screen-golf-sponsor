/**
 * 에스크로/원장 E2E 테스트
 *
 * 검증하는 불변식:
 * A) Wallet.balance와 frozenAmount는 음수가 될 수 없다
 * B) HELD 에스크로 합계 = brand.frozenAmount
 * C) RELEASED 에스크로는 athlete/platform에 정확히 분배
 * D) 같은 (walletId, type, refType, refId) LedgerTx는 1개만 존재
 * E) 계약당 에스크로는 1개만 존재
 */

import request from 'supertest';
import { app } from '../src';
import prisma from '../src/models/prisma';
import { Decimal } from '@prisma/client/runtime/library';

import {
  setupContractScenario,
  signContractBothSides,
  submitAndApproveAsset,
  submitVerification,
  ensurePlatformWallet,
  TestContractSetup,
} from './helpers/fixtures';

import {
  expectInvariantsValid,
  fetchWallet,
  countLedgerTx,
  countEscrowsForContract,
} from './helpers/invariants';

import { escrowService } from '../src/services/escrow.service';
import { contractService, verificationService } from '../src/services/contract.service';

describe('Escrow E2E Tests', () => {
  // =========================================================
  // 시나리오 1: Happy Path - HELD → RELEASED
  // =========================================================
  describe('Scenario 1: Happy Path HELD → RELEASED', () => {
    let setup: TestContractSetup;

    beforeEach(async () => {
      setup = await setupContractScenario(10000000, 1000000);
    });

    it('should hold escrow on contract signature and release on verification', async () => {
      const { contractId, brand, athlete, admin, priceFinal } = setup;

      // 1. 초기 상태 확인
      const brandWalletBefore = await fetchWallet('BRAND', brand.brandId);
      expect(brandWalletBefore).not.toBeNull();
      expect(brandWalletBefore!.balance.toNumber()).toBe(10000000);
      expect(brandWalletBefore!.frozenAmount.toNumber()).toBe(0);

      // 2. 양측 서명 완료 → 에스크로 홀드
      await signContractBothSides(contractId);
      await escrowService.holdFromContract(contractId);

      // 3. 에스크로 홀드 후 상태 확인
      const escrow = await prisma.escrow.findUnique({ where: { contractId } });
      expect(escrow).not.toBeNull();
      expect(escrow!.status).toBe('HELD');
      expect(escrow!.grossAmount.toNumber()).toBe(priceFinal);

      const brandWalletAfterHold = await fetchWallet('BRAND', brand.brandId);
      expect(brandWalletAfterHold!.balance.toNumber()).toBe(10000000 - priceFinal);
      expect(brandWalletAfterHold!.frozenAmount.toNumber()).toBe(priceFinal);

      // 불변식 검증
      await expectInvariantsValid(contractId);

      // 4. 에셋 제출 및 승인
      await submitAndApproveAsset(contractId, admin.user.id);

      // 5. 노출 인증 제출
      const verificationId = await submitVerification(contractId);

      // 6. 인증 승인 → 에스크로 릴리스
      const verification = await prisma.verification.findUnique({ where: { id: verificationId } });
      await verificationService.review(verificationId, 'VERIFIED', admin.user.id);

      // 7. 릴리스 후 상태 확인
      const escrowAfter = await prisma.escrow.findUnique({ where: { contractId } });
      expect(escrowAfter!.status).toBe('RELEASED');

      // 브랜드 frozen 해제
      const brandWalletAfterRelease = await fetchWallet('BRAND', brand.brandId);
      expect(brandWalletAfterRelease!.frozenAmount.toNumber()).toBe(0);

      // 선수 지갑에 정산금 입금
      const athleteWallet = await fetchWallet('ATHLETE', athlete.athleteId);
      expect(athleteWallet).not.toBeNull();
      expect(athleteWallet!.balance.toNumber()).toBe(escrow!.athletePayout.toNumber());

      // 플랫폼 지갑에 수수료 입금
      const platformWallet = await fetchWallet('PLATFORM', 'SYSTEM');
      expect(platformWallet!.balance.toNumber()).toBe(escrow!.platformFee.toNumber());

      // LedgerTx 중복 없음 확인
      const athleteLedgerCount = await countLedgerTx(
        athleteWallet!.id,
        'CREDIT',
        'ESCROW_RELEASE',
        escrow!.id
      );
      expect(athleteLedgerCount).toBe(1);

      // 모든 불변식 검증
      await expectInvariantsValid(contractId);
    });
  });

  // =========================================================
  // 시나리오 2: Happy Path - HELD → REFUNDED
  // =========================================================
  describe('Scenario 2: Happy Path HELD → REFUNDED', () => {
    let setup: TestContractSetup;

    beforeEach(async () => {
      setup = await setupContractScenario(10000000, 1000000);
    });

    it('should refund escrow on contract cancellation', async () => {
      const { contractId, brand, priceFinal } = setup;

      // 1. 양측 서명 완료 → 에스크로 홀드
      await signContractBothSides(contractId);
      await escrowService.holdFromContract(contractId);

      const brandWalletAfterHold = await fetchWallet('BRAND', brand.brandId);
      expect(brandWalletAfterHold!.balance.toNumber()).toBe(10000000 - priceFinal);
      expect(brandWalletAfterHold!.frozenAmount.toNumber()).toBe(priceFinal);

      // 2. 계약 취소 → 에스크로 환불
      await contractService.cancel(contractId, '테스트 취소');

      // 3. 환불 후 상태 확인
      const escrow = await prisma.escrow.findUnique({ where: { contractId } });
      expect(escrow!.status).toBe('REFUNDED');

      const brandWalletAfterRefund = await fetchWallet('BRAND', brand.brandId);
      expect(brandWalletAfterRefund!.balance.toNumber()).toBe(10000000); // 원복
      expect(brandWalletAfterRefund!.frozenAmount.toNumber()).toBe(0);

      // LedgerTx 환불 1회만 기록
      const refundLedgerCount = await countLedgerTx(
        brandWalletAfterRefund!.id,
        'CREDIT',
        'ESCROW_REFUND',
        escrow!.id
      );
      expect(refundLedgerCount).toBe(1);

      // 불변식 검증
      await expectInvariantsValid(contractId);
    });
  });

  // =========================================================
  // 시나리오 3: 멱등성 - releaseToAthlete 2번 호출
  // =========================================================
  describe('Scenario 3: Idempotency - releaseToAthlete called twice', () => {
    let setup: TestContractSetup;

    beforeEach(async () => {
      setup = await setupContractScenario(10000000, 1000000);
    });

    it('should only release once even when called twice', async () => {
      const { contractId, athlete, admin } = setup;

      // 1. 에스크로 홀드
      await signContractBothSides(contractId);
      await escrowService.holdFromContract(contractId);

      // 2. 에셋/인증 준비
      await submitAndApproveAsset(contractId, admin.user.id);
      await submitVerification(contractId);

      // 3. 에스크로 상태를 직접 VERIFIED로 변경 (서비스 호출 대신)
      await prisma.contract.update({
        where: { id: contractId },
        data: { status: 'VERIFIED' },
      });

      // 4. releaseToAthlete 첫 번째 호출
      const result1 = await escrowService.releaseToAthlete(contractId);
      expect(result1.alreadyProcessed).toBe(false);

      // 5. releaseToAthlete 두 번째 호출 (멱등성)
      const result2 = await escrowService.releaseToAthlete(contractId);
      expect(result2.alreadyProcessed).toBe(true);

      // 6. 에스크로는 여전히 RELEASED
      const escrow = await prisma.escrow.findUnique({ where: { contractId } });
      expect(escrow!.status).toBe('RELEASED');

      // 7. 선수 지갑은 1번만 증가
      const athleteWallet = await fetchWallet('ATHLETE', athlete.athleteId);
      expect(athleteWallet!.balance.toNumber()).toBe(escrow!.athletePayout.toNumber());

      // 8. LedgerTx도 1개만 존재
      const athleteLedgerCount = await countLedgerTx(
        athleteWallet!.id,
        'CREDIT',
        'ESCROW_RELEASE',
        escrow!.id
      );
      expect(athleteLedgerCount).toBe(1);

      // 불변식 검증
      await expectInvariantsValid(contractId);
    });
  });

  // =========================================================
  // 시나리오 4: 멱등성 - refundToBrand 2번 호출
  // =========================================================
  describe('Scenario 4: Idempotency - refundToBrand called twice', () => {
    let setup: TestContractSetup;

    beforeEach(async () => {
      setup = await setupContractScenario(10000000, 1000000);
    });

    it('should only refund once even when called twice', async () => {
      const { contractId, brand } = setup;

      // 1. 에스크로 홀드
      await signContractBothSides(contractId);
      await escrowService.holdFromContract(contractId);

      // 2. refundToBrand 첫 번째 호출
      const result1 = await escrowService.refundToBrand(contractId, '테스트');
      expect(result1.alreadyProcessed).toBe(false);

      // 3. refundToBrand 두 번째 호출 (멱등성)
      const result2 = await escrowService.refundToBrand(contractId, '테스트');
      expect(result2.alreadyProcessed).toBe(true);

      // 4. 에스크로는 여전히 REFUNDED
      const escrow = await prisma.escrow.findUnique({ where: { contractId } });
      expect(escrow!.status).toBe('REFUNDED');

      // 5. 브랜드 지갑은 원래대로 (1번만 환불)
      const brandWallet = await fetchWallet('BRAND', brand.brandId);
      expect(brandWallet!.balance.toNumber()).toBe(10000000);
      expect(brandWallet!.frozenAmount.toNumber()).toBe(0);

      // 6. LedgerTx도 1개만 존재
      const refundLedgerCount = await countLedgerTx(
        brandWallet!.id,
        'CREDIT',
        'ESCROW_REFUND',
        escrow!.id
      );
      expect(refundLedgerCount).toBe(1);

      // 불변식 검증
      await expectInvariantsValid(contractId);
    });
  });

  // =========================================================
  // 시나리오 5: 동시성 - holdFromContract 동시에 2개 요청
  // =========================================================
  describe('Scenario 5: Concurrency - holdFromContract called simultaneously', () => {
    let setup: TestContractSetup;

    beforeEach(async () => {
      setup = await setupContractScenario(10000000, 1000000);
    });

    it('should create only one escrow even with concurrent calls', async () => {
      const { contractId, brand, priceFinal } = setup;

      // 1. 양측 서명 완료
      await signContractBothSides(contractId);

      // 2. 동시에 holdFromContract 2번 호출
      const [result1, result2] = await Promise.all([
        escrowService.holdFromContract(contractId),
        escrowService.holdFromContract(contractId),
      ]);

      // 3. 하나는 새로 생성, 하나는 이미 처리됨
      const newCount = [result1, result2].filter(r => !r.alreadyProcessed).length;
      const alreadyCount = [result1, result2].filter(r => r.alreadyProcessed).length;
      expect(newCount).toBe(1);
      expect(alreadyCount).toBe(1);

      // 4. 에스크로는 1개만 존재
      const escrowCount = await countEscrowsForContract(contractId);
      expect(escrowCount).toBe(1);

      // 5. 브랜드 잔액은 1번만 차감
      const brandWallet = await fetchWallet('BRAND', brand.brandId);
      expect(brandWallet!.balance.toNumber()).toBe(10000000 - priceFinal);
      expect(brandWallet!.frozenAmount.toNumber()).toBe(priceFinal);

      // 6. LedgerTx도 1개만 존재
      const escrow = await prisma.escrow.findUnique({ where: { contractId } });
      const debitCount = await countLedgerTx(
        brandWallet!.id,
        'DEBIT',
        'ESCROW_HOLD',
        escrow!.id
      );
      expect(debitCount).toBe(1);

      // 불변식 검증
      await expectInvariantsValid(contractId);
    });
  });

  // =========================================================
  // 시나리오 6: 만료 크론 - processExpiredEscrows
  // =========================================================
  describe('Scenario 6: Expired Escrow Auto-Refund', () => {
    let setup: TestContractSetup;

    beforeEach(async () => {
      setup = await setupContractScenario(10000000, 1000000);
    });

    it('should auto-refund expired escrows', async () => {
      const { contractId, brand } = setup;

      // 1. 에스크로 홀드
      await signContractBothSides(contractId);
      await escrowService.holdFromContract(contractId);

      // 2. 에스크로 생성일을 31일 전으로 조작
      const escrow = await prisma.escrow.findUnique({ where: { contractId } });
      const expiredDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
      await prisma.escrow.update({
        where: { id: escrow!.id },
        data: { createdAt: expiredDate },
      });

      // 3. 만료 처리 실행
      const refundedCount = await escrowService.processExpiredEscrows(30);
      expect(refundedCount).toBe(1);

      // 4. 에스크로 상태 확인
      const escrowAfter = await prisma.escrow.findUnique({ where: { contractId } });
      expect(escrowAfter!.status).toBe('REFUNDED');

      // 5. 브랜드 잔액 원복
      const brandWallet = await fetchWallet('BRAND', brand.brandId);
      expect(brandWallet!.balance.toNumber()).toBe(10000000);
      expect(brandWallet!.frozenAmount.toNumber()).toBe(0);

      // 6. LedgerTx 환불 1회만 존재
      const refundLedgerCount = await countLedgerTx(
        brandWallet!.id,
        'CREDIT',
        'ESCROW_REFUND',
        escrow!.id
      );
      expect(refundLedgerCount).toBe(1);

      // 불변식 검증
      await expectInvariantsValid(contractId);
    });

    it('should not refund non-expired escrows', async () => {
      const { contractId, brand, priceFinal } = setup;

      // 1. 에스크로 홀드 (방금 생성됨)
      await signContractBothSides(contractId);
      await escrowService.holdFromContract(contractId);

      // 2. 만료 처리 실행 (30일 기준)
      const refundedCount = await escrowService.processExpiredEscrows(30);
      expect(refundedCount).toBe(0);

      // 3. 에스크로 상태 유지
      const escrow = await prisma.escrow.findUnique({ where: { contractId } });
      expect(escrow!.status).toBe('HELD');

      // 4. 브랜드 잔액 유지
      const brandWallet = await fetchWallet('BRAND', brand.brandId);
      expect(brandWallet!.balance.toNumber()).toBe(10000000 - priceFinal);
      expect(brandWallet!.frozenAmount.toNumber()).toBe(priceFinal);

      // 불변식 검증
      await expectInvariantsValid(contractId);
    });
  });

  // =========================================================
  // API 레벨 테스트: 계약 서명 → 에스크로 홀드
  // =========================================================
  describe('API Level: Contract Sign triggers Escrow Hold', () => {
    let setup: TestContractSetup;

    beforeEach(async () => {
      setup = await setupContractScenario(10000000, 1000000);
    });

    it('should hold escrow when both parties sign via API', async () => {
      const { contractId, brand, athlete, priceFinal } = setup;

      // 1. 브랜드 서명 (API)
      const brandSignRes = await request(app)
        .post(`/api/contracts/${contractId}/sign`)
        .set('Authorization', `Bearer ${brand.user.token}`)
        .send();

      expect(brandSignRes.status).toBe(200);

      // 아직 에스크로 없음
      let escrow = await prisma.escrow.findUnique({ where: { contractId } });
      expect(escrow).toBeNull();

      // 2. 선수 서명 (API) → 에스크로 홀드 트리거
      const athleteSignRes = await request(app)
        .post(`/api/contracts/${contractId}/sign`)
        .set('Authorization', `Bearer ${athlete.user.token}`)
        .send();

      expect(athleteSignRes.status).toBe(200);

      // 3. 에스크로 생성 확인
      escrow = await prisma.escrow.findUnique({ where: { contractId } });
      expect(escrow).not.toBeNull();
      expect(escrow!.status).toBe('HELD');

      // 4. 브랜드 지갑 확인
      const brandWallet = await fetchWallet('BRAND', brand.brandId);
      expect(brandWallet!.balance.toNumber()).toBe(10000000 - priceFinal);
      expect(brandWallet!.frozenAmount.toNumber()).toBe(priceFinal);

      // 불변식 검증
      await expectInvariantsValid(contractId);
    });
  });

  // =========================================================
  // API 레벨 테스트: 인증 승인 → 에스크로 릴리스
  // =========================================================
  describe('API Level: Verification Approval triggers Escrow Release', () => {
    let setup: TestContractSetup;

    beforeEach(async () => {
      setup = await setupContractScenario(10000000, 1000000);
    });

    it('should release escrow when verification is approved via API', async () => {
      const { contractId, brand, athlete, admin } = setup;

      // 1. 양측 서명 + 에스크로 홀드
      await signContractBothSides(contractId);
      await escrowService.holdFromContract(contractId);

      // 2. 에셋 제출/승인, 인증 제출
      await submitAndApproveAsset(contractId, admin.user.id);
      const verificationId = await submitVerification(contractId);

      // 3. 인증 승인 (API)
      const approveRes = await request(app)
        .post(`/api/contracts/verifications/${verificationId}/review`)
        .set('Authorization', `Bearer ${admin.user.token}`)
        .send({ status: 'VERIFIED' });

      expect(approveRes.status).toBe(200);

      // 4. 에스크로 릴리스 확인
      const escrow = await prisma.escrow.findUnique({ where: { contractId } });
      expect(escrow!.status).toBe('RELEASED');

      // 5. 선수 지갑 입금 확인
      const athleteWallet = await fetchWallet('ATHLETE', athlete.athleteId);
      expect(athleteWallet!.balance.toNumber()).toBe(escrow!.athletePayout.toNumber());

      // 6. 플랫폼 지갑 수수료 확인
      const platformWallet = await fetchWallet('PLATFORM', 'SYSTEM');
      expect(platformWallet!.balance.toNumber()).toBe(escrow!.platformFee.toNumber());

      // 불변식 검증
      await expectInvariantsValid(contractId);
    });
  });
});
