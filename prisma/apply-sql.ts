/**
 * 마이그레이션 SQL 수동 적용 헬퍼 (psql 없이 실행)
 * 실행: DATABASE_URL=<url> npx ts-node prisma/apply-sql.ts prisma/migrations/<dir>/migration.sql
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error('사용법: npx ts-node prisma/apply-sql.ts <migration.sql>');
  const sql = fs.readFileSync(file, 'utf8');
  // 세미콜론 단위 실행 (DO $$ ... $$ 블록은 하나로 유지)
  const statements = sql
    .split(/;\s*$/m)
    // 앞머리 주석 줄만 제거한다 (문장 전체를 버리면 실제 DDL이 누락됨)
    .map((s) =>
      s
        .split('\n')
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n')
        .trim()
    )
    .filter(Boolean);
  for (const st of statements) {
    console.log('▶', st.split('\n')[0].slice(0, 90));
    await prisma.$executeRawUnsafe(st);
  }
  console.log(`✅ ${statements.length}개 문 실행 완료 — ${file}`);
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); }).finally(() => prisma.$disconnect());
