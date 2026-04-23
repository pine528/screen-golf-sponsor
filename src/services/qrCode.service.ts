/**
 * QR Code Service
 *
 * - URL → PNG QR 코드 생성
 * - Cloudinary 업로드 → public URL 반환 (실패 시 local fallback)
 * - 트래킹 링크 발급 시 자동 호출됨
 *
 * Refs:
 * - sponpik_full_funnel_handoff.docx > 핵심 기능 > 커스텀 트래킹 링크
 * - sponpik_full_funnel_api_spec.docx > 4-1. 트래킹 자산 생성 > qr_url
 */

import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const UPLOAD_DIR = path.resolve(__dirname, '../../uploads/qr');
const PUBLIC_URL_PREFIX = process.env.PUBLIC_URL_PREFIX || 'http://localhost:3000';

export class QRCodeService {
  /**
   * URL → QR PNG buffer
   */
  async generateBuffer(url: string, size = 512): Promise<Buffer> {
    return QRCode.toBuffer(url, {
      type: 'png',
      width: size,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0f172a',  // slate-900
        light: '#ffffff',
      },
    });
  }

  /**
   * URL → QR PNG 파일 저장 + public URL 반환
   * (Cloudinary 미설정 시 로컬 폴백)
   */
  async generateAndStore(url: string, filename?: string): Promise<string> {
    const buffer = await this.generateBuffer(url);
    const name = filename || `qr_${uuidv4()}.png`;

    // 디렉토리 보장
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }

    const filepath = path.join(UPLOAD_DIR, name);
    fs.writeFileSync(filepath, buffer);

    // 공개 URL 반환 (express.static('uploads')로 서빙)
    return `${PUBLIC_URL_PREFIX}/uploads/qr/${name}`;
  }

  /**
   * Data URL (base64) 형식으로 반환 (작은 QR이거나 inline 표시용)
   */
  async generateDataUrl(url: string, size = 256): Promise<string> {
    return QRCode.toDataURL(url, {
      type: 'image/png',
      width: size,
      margin: 2,
      errorCorrectionLevel: 'M',
    });
  }
}

export const qrCodeService = new QRCodeService();
