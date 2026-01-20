import { BadRequestError } from './errors';

interface DangerZoneParams {
  confirmText: string;        // 사용자가 입력해야 할 확인 텍스트
  expectedConfirmText: string; // 기대하는 확인 텍스트
  reason: string;             // 작업 사유 (최소 10자)
}

/**
 * Danger Zone 작업 검증
 * - 확인 텍스트가 일치하는지 확인
 * - 사유가 10자 이상인지 확인
 */
export function validateDangerZone(params: DangerZoneParams): void {
  const { confirmText, expectedConfirmText, reason } = params;

  if (!confirmText || confirmText !== expectedConfirmText) {
    throw new BadRequestError(
      `확인 텍스트를 정확히 입력해주세요: "${expectedConfirmText}"`,
      'CONFIRM_TEXT_MISMATCH'
    );
  }

  if (!reason || reason.trim().length < 10) {
    throw new BadRequestError(
      '사유는 최소 10자 이상 입력해주세요',
      'REASON_TOO_SHORT'
    );
  }
}

/**
 * Danger Zone 필드 추출 및 검증
 * - body에서 confirmText와 reason 추출
 * - 검증 후 반환
 */
export function extractAndValidateDangerZone(
  body: { confirmText?: string; reason?: string },
  expectedConfirmText: string
): { confirmText: string; reason: string } {
  const confirmText = body.confirmText || '';
  const reason = body.reason || '';

  validateDangerZone({ confirmText, expectedConfirmText, reason });

  return { confirmText, reason };
}

/**
 * 역할 변경용 확인 텍스트 생성
 */
export function getRoleChangeConfirmText(email: string): string {
  return `CHANGE_ROLE_${email}`;
}

/**
 * 계정 비활성화용 확인 텍스트 생성
 */
export function getDeactivateConfirmText(email: string): string {
  return `DEACTIVATE_${email}`;
}
