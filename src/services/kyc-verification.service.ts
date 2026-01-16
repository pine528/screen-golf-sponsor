/**
 * KYC 자동 검증 서비스
 * - 사업자등록번호 진위확인 (국세청 API)
 * - 향후 확장: 신분증 OCR, 얼굴 인식 등
 */

interface BusinessVerificationResult {
  isValid: boolean;
  businessNumber: string;
  businessStatus: string; // '01': 계속사업자, '02': 휴업자, '03': 폐업자
  taxType: string;
  message: string;
  verifiedAt: string; // ISO string for JSON serialization
}

export interface VerificationResponse {
  success: boolean;
  data?: BusinessVerificationResult;
  error?: string;
  [key: string]: unknown; // Index signature for Prisma JSON compatibility
}

class KycVerificationService {
  private readonly NTS_API_URL = 'https://api.odcloud.kr/api/nts-businessman/v1/status';
  private readonly apiKey = process.env.NTS_API_KEY || '';

  /**
   * 사업자등록번호 형식 검증 (10자리 숫자)
   */
  validateBusinessNumberFormat(businessNumber: string): boolean {
    // 하이픈 제거
    const cleaned = businessNumber.replace(/-/g, '');

    // 10자리 숫자인지 확인
    if (!/^\d{10}$/.test(cleaned)) {
      return false;
    }

    // 사업자등록번호 체크섬 검증
    const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5];
    let sum = 0;

    for (let i = 0; i < 9; i++) {
      sum += parseInt(cleaned[i]) * weights[i];
    }

    sum += Math.floor((parseInt(cleaned[8]) * 5) / 10);
    const checkDigit = (10 - (sum % 10)) % 10;

    return checkDigit === parseInt(cleaned[9]);
  }

  /**
   * 국세청 API를 통한 사업자등록번호 진위확인
   */
  async verifyBusinessNumber(businessNumber: string): Promise<VerificationResponse> {
    // 형식 검증
    const cleaned = businessNumber.replace(/-/g, '');

    if (!this.validateBusinessNumberFormat(cleaned)) {
      return {
        success: false,
        error: '유효하지 않은 사업자등록번호 형식입니다.',
      };
    }

    // API 키가 없으면 형식 검증만 통과 (자동 승인 불가)
    if (!this.apiKey) {
      console.warn('NTS_API_KEY not configured. Skipping API verification.');
      return {
        success: true,
        data: {
          isValid: false, // API 키 없이는 자동 승인 불가
          businessNumber: cleaned,
          businessStatus: 'UNKNOWN',
          taxType: 'UNKNOWN',
          message: 'API 키가 설정되지 않아 형식 검증만 완료되었습니다. 관리자 검토가 필요합니다.',
          verifiedAt: new Date().toISOString(),
        },
      };
    }

    try {
      const response = await fetch(this.NTS_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Infuser ${this.apiKey}`,
        },
        body: JSON.stringify({
          b_no: [cleaned],
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const result = await response.json() as { data?: Array<{ b_stt_cd: string; tax_type?: string }> };

      if (result.data && result.data.length > 0) {
        const businessData = result.data[0];
        const isValid = businessData.b_stt_cd === '01'; // 계속사업자

        return {
          success: true,
          data: {
            isValid,
            businessNumber: cleaned,
            businessStatus: this.getBusinessStatusLabel(businessData.b_stt_cd),
            taxType: businessData.tax_type || 'UNKNOWN',
            message: isValid
              ? '유효한 사업자등록번호입니다.'
              : `사업자 상태: ${this.getBusinessStatusLabel(businessData.b_stt_cd)}`,
            verifiedAt: new Date().toISOString(),
          },
        };
      }

      return {
        success: false,
        error: '사업자 정보를 찾을 수 없습니다.',
      };
    } catch (error) {
      console.error('Business number verification error:', error);
      return {
        success: false,
        error: '사업자등록번호 확인 중 오류가 발생했습니다.',
      };
    }
  }

  /**
   * 사업자 상태 코드를 한글로 변환
   */
  private getBusinessStatusLabel(code: string): string {
    const statusMap: Record<string, string> = {
      '01': '계속사업자',
      '02': '휴업자',
      '03': '폐업자',
    };
    return statusMap[code] || '알 수 없음';
  }

  /**
   * 브랜드 KYC 자동 검증
   * - 사업자등록번호 확인
   * - 서류 검증 결과 저장
   */
  async verifyBrandKyc(data: {
    businessNumber: string;
    representativeName?: string;
    companyName?: string;
  }): Promise<{
    passed: boolean;
    results: {
      businessNumberVerification: VerificationResponse;
    };
    autoApprove: boolean;
  }> {
    const businessResult = await this.verifyBusinessNumber(data.businessNumber);

    // 자동 승인 조건: 사업자등록번호가 유효한 계속사업자
    const autoApprove = businessResult.success && businessResult.data?.isValid === true;

    return {
      passed: businessResult.success,
      results: {
        businessNumberVerification: businessResult,
      },
      autoApprove,
    };
  }

  /**
   * 선수 KYC 검증 (현재는 서류 제출만 확인)
   * 향후 신분증 OCR, 본인인증 등 추가 가능
   */
  async verifyAthleteKyc(data: {
    documents: { type: string; url: string }[];
  }): Promise<{
    passed: boolean;
    message: string;
  }> {
    // 필수 서류 확인
    const hasIdCard = data.documents.some(d => d.type === 'id_card');

    if (!hasIdCard) {
      return {
        passed: false,
        message: '신분증 서류가 필요합니다.',
      };
    }

    // 현재는 서류 제출 여부만 확인
    // 향후 OCR, 본인인증 API 연동 가능
    return {
      passed: true,
      message: '서류가 제출되었습니다. 관리자 검토 후 승인됩니다.',
    };
  }
}

export const kycVerificationService = new KycVerificationService();
