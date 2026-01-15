/**
 * 테스트 전용 시드
 * 최소한의 데이터만 생성 (플랫폼 지갑 등)
 */

import prisma from '../src/models/prisma';
import { Decimal } from '@prisma/client/runtime/library';

async function main() {
  console.log('[Test Seed] Starting...');

  // 플랫폼 지갑 생성
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

  console.log('[Test Seed] Platform wallet created');
  console.log('[Test Seed] Complete');
}

main()
  .catch((e) => {
    console.error('[Test Seed] Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
