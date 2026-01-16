import dotenv from 'dotenv';

dotenv.config();

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
