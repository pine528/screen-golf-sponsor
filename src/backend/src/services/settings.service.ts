import prisma from '../models/prisma';

// 기본 설정값
const DEFAULT_SETTINGS: Record<string, { value: string; description: string }> = {
  KYC_AUTO_APPROVE_ENABLED: {
    value: 'false',
    description: 'KYC 자동 승인 활성화 여부 (사업자등록번호 확인 시)',
  },
  PLATFORM_FEE_RATE: {
    value: '0.1',
    description: '플랫폼 수수료율 (0.1 = 10%)',
  },
};

class SettingsService {
  /**
   * 설정값 조회
   */
  async get(key: string): Promise<string | null> {
    const setting = await prisma.systemSetting.findUnique({
      where: { key },
    });

    if (setting) {
      return setting.value;
    }

    // 기본값이 있으면 반환
    if (DEFAULT_SETTINGS[key]) {
      return DEFAULT_SETTINGS[key].value;
    }

    return null;
  }

  /**
   * 설정값 조회 (boolean)
   */
  async getBoolean(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value === 'true';
  }

  /**
   * 설정값 조회 (number)
   */
  async getNumber(key: string): Promise<number | null> {
    const value = await this.get(key);
    if (value === null) return null;
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
  }

  /**
   * 설정값 저장/업데이트
   */
  async set(key: string, value: string, description?: string): Promise<void> {
    await prisma.systemSetting.upsert({
      where: { key },
      update: { value, description },
      create: { key, value, description },
    });
  }

  /**
   * 모든 설정 조회
   */
  async getAll(): Promise<Record<string, { value: string; description: string | null }>> {
    const settings = await prisma.systemSetting.findMany();

    const result: Record<string, { value: string; description: string | null }> = {};

    // 기본값 먼저 추가
    for (const [key, defaultSetting] of Object.entries(DEFAULT_SETTINGS)) {
      result[key] = {
        value: defaultSetting.value,
        description: defaultSetting.description,
      };
    }

    // DB 값으로 덮어쓰기
    for (const setting of settings) {
      result[setting.key] = {
        value: setting.value,
        description: setting.description,
      };
    }

    return result;
  }

  /**
   * 기본 설정값 초기화 (DB에 없는 것만)
   */
  async initializeDefaults(): Promise<void> {
    for (const [key, setting] of Object.entries(DEFAULT_SETTINGS)) {
      const existing = await prisma.systemSetting.findUnique({ where: { key } });
      if (!existing) {
        await prisma.systemSetting.create({
          data: {
            key,
            value: setting.value,
            description: setting.description,
          },
        });
      }
    }
  }
}

export const settingsService = new SettingsService();
