/**
 * 계좌번호 암호화/복호화 유틸리티
 * AES-256-GCM 사용 (인증 태그로 무결성 보장)
 *
 * 환경변수: BANK_ACCOUNT_ENC_KEY (32 bytes base64)
 * 생성: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits

/**
 * 암호화 키 가져오기
 * 키가 없거나 길이가 맞지 않으면 에러 발생
 */
const getEncryptionKey = (): Buffer => {
  const key = process.env.BANK_ACCOUNT_ENC_KEY;
  if (!key) {
    throw new Error('BANK_ACCOUNT_ENC_KEY 환경변수가 설정되지 않았습니다');
  }

  const decoded = Buffer.from(key, 'base64');
  if (decoded.length !== KEY_LENGTH) {
    throw new Error(
      `BANK_ACCOUNT_ENC_KEY는 ${KEY_LENGTH}바이트(256비트)여야 합니다. 현재: ${decoded.length}바이트`
    );
  }

  return decoded;
};

/**
 * 암호화된 계좌 정보 인터페이스
 */
export interface EncryptedAccount {
  encrypted: string; // base64 인코딩된 암호문
  iv: string; // base64 인코딩된 IV
  tag: string; // base64 인코딩된 인증 태그
  last4: string; // 계좌번호 뒤 4자리
  masked: string; // 마스킹된 계좌번호 (***1234)
}

/**
 * 계좌번호 암호화
 * @param plainAccount 평문 계좌번호
 * @returns 암호화된 계좌 정보
 */
export const encryptAccountNumber = (plainAccount: string): EncryptedAccount => {
  if (!plainAccount || plainAccount.trim() === '') {
    throw new Error('계좌번호가 비어있습니다');
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainAccount, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const tag = cipher.getAuthTag();

  // 마스킹 처리
  const last4 = plainAccount.length >= 4 ? plainAccount.slice(-4) : plainAccount;
  const maskedLength = Math.max(0, plainAccount.length - 4);
  const masked = '*'.repeat(maskedLength) + last4;

  return {
    encrypted,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    last4,
    masked,
  };
};

/**
 * 계좌번호 복호화
 * @param encrypted base64 인코딩된 암호문
 * @param iv base64 인코딩된 IV
 * @param tag base64 인코딩된 인증 태그
 * @returns 평문 계좌번호
 */
export const decryptAccountNumber = (
  encrypted: string,
  iv: string,
  tag: string
): string => {
  if (!encrypted || !iv || !tag) {
    throw new Error('복호화에 필요한 데이터가 누락되었습니다');
  }

  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(tag, 'base64'));

  let decrypted = decipher.update(encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
};

/**
 * 암호화 키 유효성 검증
 * 서버 부팅 시 호출하여 키 설정 확인
 */
export const validateEncryptionKey = (): boolean => {
  try {
    const key = process.env.BANK_ACCOUNT_ENC_KEY;
    if (!key) {
      console.error('[FATAL] BANK_ACCOUNT_ENC_KEY 환경변수가 설정되지 않았습니다');
      return false;
    }

    const decoded = Buffer.from(key, 'base64');
    if (decoded.length !== KEY_LENGTH) {
      console.error(
        `[FATAL] BANK_ACCOUNT_ENC_KEY는 ${KEY_LENGTH}바이트(256비트)여야 합니다. 현재: ${decoded.length}바이트`
      );
      return false;
    }

    // 암호화/복호화 테스트
    const testData = '1234567890';
    const encResult = encryptAccountNumber(testData);
    const decResult = decryptAccountNumber(encResult.encrypted, encResult.iv, encResult.tag);

    if (decResult !== testData) {
      console.error('[FATAL] 암호화 키 검증 실패: 암복호화 결과가 일치하지 않습니다');
      return false;
    }

    console.log('[Crypto] 암호화 키 검증 완료');
    return true;
  } catch (error: any) {
    console.error(`[FATAL] 암호화 키 검증 실패: ${error.message}`);
    return false;
  }
};
