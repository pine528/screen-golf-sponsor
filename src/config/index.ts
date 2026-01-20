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
 * 운영 환경(production)에서 추가로 필요한 환경변수
 */
const PRODUCTION_REQUIRED_ENVS = [
  'PORTONE_API_KEY',
  'PORTONE_API_SECRET',
];

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

  // 운영 환경에서는 추가 환경변수 체크
  if (nodeEnv === 'production') {
    for (const key of PRODUCTION_REQUIRED_ENVS) {
      if (!process.env[key]) {
        missing.push(key);
      }
    }
  }

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
