import { Prisma } from '@prisma/client';
import prisma from '../models/prisma';
import { NotFoundError, BadRequestError } from '../utils/errors';

// DTO 타입
export interface CreateBillingProfileDto {
  businessName: string;
  businessNumber: string;
  representativeName: string;
  businessType?: string;
  businessCategory?: string;
  billingEmail: string;
  billingPhone?: string;
  address: string;
  addressDetail?: string;
}

export interface UpdateBillingProfileDto {
  businessName?: string;
  businessNumber?: string;
  representativeName?: string;
  businessType?: string;
  businessCategory?: string;
  billingEmail?: string;
  billingPhone?: string;
  address?: string;
  addressDetail?: string;
}

export class BillingProfileService {
  /**
   * 브랜드의 청구 프로필 조회
   */
  async getByBrandId(brandId: string) {
    const profile = await prisma.billingProfile.findUnique({
      where: { brandId },
    });

    return profile;
  }

  /**
   * 청구 프로필 생성
   */
  async create(brandId: string, data: CreateBillingProfileDto) {
    // 이미 존재하는지 확인
    const existing = await prisma.billingProfile.findUnique({
      where: { brandId },
    });

    if (existing) {
      throw new BadRequestError('청구 프로필이 이미 존재합니다. 수정하려면 PATCH를 사용하세요.');
    }

    // 사업자등록번호 형식 검증 (간단한 패턴)
    if (!this.isValidBusinessNumber(data.businessNumber)) {
      throw new BadRequestError('올바른 사업자등록번호 형식이 아닙니다 (예: 123-45-67890)');
    }

    const profile = await prisma.billingProfile.create({
      data: {
        brandId,
        businessName: data.businessName,
        businessNumber: data.businessNumber,
        representativeName: data.representativeName,
        businessType: data.businessType,
        businessCategory: data.businessCategory,
        billingEmail: data.billingEmail,
        billingPhone: data.billingPhone,
        address: data.address,
        addressDetail: data.addressDetail,
      },
    });

    return profile;
  }

  /**
   * 청구 프로필 수정
   */
  async update(brandId: string, data: UpdateBillingProfileDto) {
    const existing = await prisma.billingProfile.findUnique({
      where: { brandId },
    });

    if (!existing) {
      throw new NotFoundError('청구 프로필을 찾을 수 없습니다. 먼저 생성해주세요.');
    }

    // 사업자등록번호가 제공되면 형식 검증
    if (data.businessNumber && !this.isValidBusinessNumber(data.businessNumber)) {
      throw new BadRequestError('올바른 사업자등록번호 형식이 아닙니다 (예: 123-45-67890)');
    }

    const updateData: Prisma.BillingProfileUpdateInput = {};
    if (data.businessName !== undefined) updateData.businessName = data.businessName;
    if (data.businessNumber !== undefined) updateData.businessNumber = data.businessNumber;
    if (data.representativeName !== undefined) updateData.representativeName = data.representativeName;
    if (data.businessType !== undefined) updateData.businessType = data.businessType;
    if (data.businessCategory !== undefined) updateData.businessCategory = data.businessCategory;
    if (data.billingEmail !== undefined) updateData.billingEmail = data.billingEmail;
    if (data.billingPhone !== undefined) updateData.billingPhone = data.billingPhone;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.addressDetail !== undefined) updateData.addressDetail = data.addressDetail;

    const profile = await prisma.billingProfile.update({
      where: { brandId },
      data: updateData,
    });

    return profile;
  }

  /**
   * 사업자등록번호 형식 검증
   * 형식: XXX-XX-XXXXX 또는 XXXXXXXXXX
   */
  private isValidBusinessNumber(bizNo: string): boolean {
    // 하이픈 제거 후 10자리 숫자인지 확인
    const normalized = bizNo.replace(/-/g, '');
    return /^\d{10}$/.test(normalized);
  }
}

export const billingProfileService = new BillingProfileService();
