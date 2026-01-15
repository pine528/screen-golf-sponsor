import { Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../types';
import { sendSuccess } from '../utils/response';
import { NotFoundError, ConflictError, BadRequestError } from '../utils/errors';

const prisma = new PrismaClient();

// ============================================
// Favorites
// ============================================

export const getFavorites = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const fanId = req.user!.fanId;
    if (!fanId) {
      throw new BadRequestError('팬 프로필을 찾을 수 없습니다');
    }

    const [favoriteAthletes, favoriteBrands] = await Promise.all([
      prisma.favoriteAthlete.findMany({
        where: { fanId },
        include: {
          athlete: {
            select: {
              id: true,
              name: true,
              tour: true,
              profileImageUrl: true,
              bio: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.favoriteBrand.findMany({
        where: { fanId },
        include: {
          brand: {
            select: {
              id: true,
              name: true,
              category: true,
              website: true,
              description: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    sendSuccess(res, {
      athletes: favoriteAthletes.map((f) => ({
        ...f.athlete,
        favoritedAt: f.createdAt,
      })),
      brands: favoriteBrands.map((f) => ({
        ...f.brand,
        favoritedAt: f.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
};

export const addFavoriteAthlete = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const fanId = req.user!.fanId;
    const { athleteId } = req.params;

    if (!fanId) {
      throw new BadRequestError('팬 프로필을 찾을 수 없습니다');
    }

    // Check if athlete exists
    const athlete = await prisma.athlete.findUnique({
      where: { id: athleteId },
    });
    if (!athlete) {
      throw new NotFoundError('선수를 찾을 수 없습니다');
    }

    // Check if already favorited
    const existing = await prisma.favoriteAthlete.findUnique({
      where: {
        fanId_athleteId: { fanId, athleteId },
      },
    });
    if (existing) {
      throw new ConflictError('이미 즐겨찾기에 추가된 선수입니다');
    }

    const favorite = await prisma.favoriteAthlete.create({
      data: { fanId, athleteId },
      include: {
        athlete: {
          select: {
            id: true,
            name: true,
            tour: true,
            profileImageUrl: true,
          },
        },
      },
    });

    sendSuccess(res, {
      ...favorite.athlete,
      favoritedAt: favorite.createdAt,
    }, 201);
  } catch (error) {
    next(error);
  }
};

export const removeFavoriteAthlete = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const fanId = req.user!.fanId;
    const { athleteId } = req.params;

    if (!fanId) {
      throw new BadRequestError('팬 프로필을 찾을 수 없습니다');
    }

    const favorite = await prisma.favoriteAthlete.findUnique({
      where: {
        fanId_athleteId: { fanId, athleteId },
      },
    });
    if (!favorite) {
      throw new NotFoundError('즐겨찾기에 없는 선수입니다');
    }

    await prisma.favoriteAthlete.delete({
      where: { id: favorite.id },
    });

    sendSuccess(res, { message: '즐겨찾기에서 제거되었습니다' });
  } catch (error) {
    next(error);
  }
};

export const addFavoriteBrand = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const fanId = req.user!.fanId;
    const { brandId } = req.params;

    if (!fanId) {
      throw new BadRequestError('팬 프로필을 찾을 수 없습니다');
    }

    // Check if brand exists
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
    });
    if (!brand) {
      throw new NotFoundError('브랜드를 찾을 수 없습니다');
    }

    // Check if already favorited
    const existing = await prisma.favoriteBrand.findUnique({
      where: {
        fanId_brandId: { fanId, brandId },
      },
    });
    if (existing) {
      throw new ConflictError('이미 즐겨찾기에 추가된 브랜드입니다');
    }

    const favorite = await prisma.favoriteBrand.create({
      data: { fanId, brandId },
      include: {
        brand: {
          select: {
            id: true,
            name: true,
            category: true,
            website: true,
          },
        },
      },
    });

    sendSuccess(res, {
      ...favorite.brand,
      favoritedAt: favorite.createdAt,
    }, 201);
  } catch (error) {
    next(error);
  }
};

export const removeFavoriteBrand = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const fanId = req.user!.fanId;
    const { brandId } = req.params;

    if (!fanId) {
      throw new BadRequestError('팬 프로필을 찾을 수 없습니다');
    }

    const favorite = await prisma.favoriteBrand.findUnique({
      where: {
        fanId_brandId: { fanId, brandId },
      },
    });
    if (!favorite) {
      throw new NotFoundError('즐겨찾기에 없는 브랜드입니다');
    }

    await prisma.favoriteBrand.delete({
      where: { id: favorite.id },
    });

    sendSuccess(res, { message: '즐겨찾기에서 제거되었습니다' });
  } catch (error) {
    next(error);
  }
};

// ============================================
// Brand Registration Request
// ============================================

export const submitBrandRegistration = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const fanId = req.user!.fanId;
    const userId = req.user!.id;
    const { brandName, contactEmail, contactPhone, website, note } = req.body;

    if (!fanId) {
      throw new BadRequestError('팬 프로필을 찾을 수 없습니다');
    }

    // Check if there's already a pending request
    const existingPending = await prisma.brandRegistrationRequest.findFirst({
      where: {
        fanId,
        status: 'SUBMITTED',
      },
    });
    if (existingPending) {
      throw new ConflictError('이미 대기 중인 브랜드 등록 신청이 있습니다');
    }

    const request = await prisma.brandRegistrationRequest.create({
      data: {
        fanId,
        brandName,
        contactEmail,
        contactPhone: contactPhone || null,
        website: website || null,
        note: note || null,
      },
    });

    // Create notification for admins
    const admins = await prisma.admin.findMany({
      select: { userId: true },
    });

    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map((admin) => ({
          userId: admin.userId,
          type: 'BRAND_REGISTRATION_SUBMITTED',
          title: '새 브랜드 등록 신청',
          message: `${brandName} 브랜드 등록 신청이 접수되었습니다.`,
          data: { requestId: request.id, brandName },
        })),
      });
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'BRAND_REGISTRATION_SUBMIT',
        entityType: 'BrandRegistrationRequest',
        entityId: request.id,
        newValue: {
          brandName,
          contactEmail,
          contactPhone,
          website,
        },
      },
    });

    sendSuccess(res, request, 201);
  } catch (error) {
    next(error);
  }
};

export const getMyBrandRegistrations = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const fanId = req.user!.fanId;

    if (!fanId) {
      throw new BadRequestError('팬 프로필을 찾을 수 없습니다');
    }

    const requests = await prisma.brandRegistrationRequest.findMany({
      where: { fanId },
      orderBy: { createdAt: 'desc' },
    });

    sendSuccess(res, requests);
  } catch (error) {
    next(error);
  }
};
