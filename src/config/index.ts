import dotenv from 'dotenv';

dotenv.config();

/**
 * 필수 환경변수 목록
 * 운영 환경에서 반드시 설정해야 하는 값들
 */
const REQUIRED_ENVS = [
  'DATABASE_URL',
  'JWT_SECRET',
];

/**
 * 결제 연동 환경변수 안내 (validateEnv에서 강제하지 않음)
 *
 * PortOne V2 + TossPayments 채널 사용 시:
 * - PORTONE_V2_API_SECRET (필수) - PortOne V2 API 시크릿
 * - PORTONE_STORE_ID (필수) - 상점 ID (store-xxx 형식)
 * - PORTONE_CHANNEL_KEY (필수) - TossPayments 채널 키
 * - PORTONE_WEBHOOK_SECRET (선택) - Webhook 서명 검증용
 *
 * 기존 Toss 직접 연동 (TOSS_*) 및 Stripe (STRIPE_*)는 비활성화
 * → PortOne을 통한 단일 결제 채널로 통합
 */

/**
 * 환경변수 검증 함수
 * 필수 환경변수가 누락되면 서버 시작을 중단
 */
export function validateEnv(): void {
  const missing: string[] = [];
  const nodeEnv = process.env.NODE_ENV || 'development';

  // 기본 필수 환경변수 체크
  for (const key of REQUIRED_ENVS) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  // 결제: PortOne V2 사용 (PORTONE_V2_API_SECRET, PORTONE_STORE_ID, PORTONE_CHANNEL_KEY)
  // 환경변수 미설정 시 결제 기능 비활성화 (서버는 정상 동작)

  if (missing.length > 0) {
    console.error('========================================');
    console.error('FATAL: Missing required environment variables:');
    console.error(missing.map(k => `  - ${k}`).join('\n'));
    console.error('========================================');
    console.error('Server startup aborted. Please configure the missing environment variables.');
    process.exit(1);
  }

  // JWT_SECRET 기본값 경고
  if (process.env.JWT_SECRET === 'default-secret-change-me' && nodeEnv === 'production') {
    console.error('========================================');
    console.error('FATAL: JWT_SECRET is using default value in production!');
    console.error('Please set a secure JWT_SECRET environment variable.');
    console.error('========================================');
    process.exit(1);
  }
}

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database
  databaseUrl: process.env.DATABASE_URL || '',

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  // Auction Settings
  auction: {
    defaultSoftCloseSec: parseInt(process.env.DEFAULT_SOFT_CLOSE_SEC || '120', 10),
    defaultMaxExtensionSec: parseInt(process.env.DEFAULT_MAX_EXTENSION_SEC || '600', 10),
    defaultMinBidIncrement: parseInt(process.env.DEFAULT_MIN_BID_INCREMENT || '10000', 10),
    defaultMinBidIncrementPercent: parseFloat(process.env.DEFAULT_MIN_BID_INCREMENT_PERCENT || '1'),
  },

  // Platform Fee
  platform: {
    feeRate: parseFloat(process.env.PLATFORM_FEE_RATE || '0.20'), // 20%
  },

  // File Upload
  upload: {
    maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10),
    uploadDir: process.env.UPLOAD_DIR || './uploads',
  },
};

export default config;
