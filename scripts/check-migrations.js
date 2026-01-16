#!/usr/bin/env node
/**
 * 마이그레이션 누락 감지 스크립트
 * CI에서 실행하여 migration drift나 누락을 감지
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'prisma', 'migrations');

function checkMigrationsExist() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.error('❌ migrations 폴더가 없습니다.');
    process.exit(1);
  }

  const migrations = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => fs.statSync(path.join(MIGRATIONS_DIR, f)).isDirectory());

  if (migrations.length === 0) {
    console.error('❌ 마이그레이션 파일이 없습니다.');
    process.exit(1);
  }

  console.log(`✅ ${migrations.length}개의 마이그레이션 발견`);
  return migrations;
}

function checkMigrationStatus() {
  try {
    // prisma migrate status 실행
    const output = execSync('npx prisma migrate status', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    console.log('📋 Migration Status:');
    console.log(output);

    // drift 감지
    if (output.includes('drift') || output.includes('Drift')) {
      console.error('❌ 스키마 drift가 감지되었습니다. prisma migrate dev를 실행하세요.');
      process.exit(1);
    }

    // pending migrations 확인
    if (output.includes('pending') || output.includes('have not yet been applied')) {
      console.warn('⚠️ 적용되지 않은 마이그레이션이 있습니다.');
      // CI에서는 경고만 (DB가 없을 수 있음)
    }

    console.log('✅ 마이그레이션 상태 정상');
  } catch (error) {
    // DB 연결 실패는 CI에서 정상 (DB가 없을 수 있음)
    if (error.message.includes('connect') || error.message.includes('ECONNREFUSED')) {
      console.log('⚠️ DB 연결 없이 마이그레이션 파일만 검증합니다.');
      return;
    }
    console.error('❌ Migration status 체크 실패:', error.message);
    process.exit(1);
  }
}

function checkMigrationFiles() {
  const migrations = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => fs.statSync(path.join(MIGRATIONS_DIR, f)).isDirectory());

  for (const migration of migrations) {
    const migrationPath = path.join(MIGRATIONS_DIR, migration);
    const sqlFile = path.join(migrationPath, 'migration.sql');

    if (!fs.existsSync(sqlFile)) {
      console.error(`❌ ${migration}: migration.sql 파일이 없습니다.`);
      process.exit(1);
    }

    const sqlContent = fs.readFileSync(sqlFile, 'utf-8');
    if (sqlContent.trim().length === 0) {
      console.error(`❌ ${migration}: migration.sql이 비어있습니다.`);
      process.exit(1);
    }
  }

  console.log('✅ 모든 마이그레이션 파일 검증 완료');
}

// Main
console.log('🔍 마이그레이션 검증 시작...\n');

checkMigrationsExist();
checkMigrationFiles();
checkMigrationStatus();

console.log('\n✅ 마이그레이션 검증 완료!');
