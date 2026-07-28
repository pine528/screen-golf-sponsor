/**
 * Tournament Rules Controller
 * 대회 규칙 관리 및 Phase 2 승인 API
 */

import { Request, Response, NextFunction } from 'express';
import prisma from '../models/prisma';
import { phase2UnlockService, TournamentRules } from '../services/phase2Unlock.service';
import { sendSuccess } from '../utils/response';
import { NotFoundError, BadRequestError } from '../utils/errors';

// Request with user type
interface AuthRequest extends Request {
  user?: { id: string; role: string };
}

/**
 * 대회 규칙 조회
 * GET /api/events/:eventId/tournament-rules
 */
export const getTournamentRules = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { eventId } = req.params;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        name: true,
        tour: true,
        dateStart: true,
        dateEnd: true,
        tournamentRules: true,
      },
    });

    if (!event) {
      throw new NotFoundError('Event not found');
    }

    const rules = phase2UnlockService.parseTournamentRules(event.tournamentRules);

    return sendSuccess(res, {
      event: {
        id: event.id,
        name: event.name,
        tour: event.tour,
        dateStart: event.dateStart,
        dateEnd: event.dateEnd,
      },
      rules,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 대회 규칙 업데이트 (Admin)
 * PUT /api/admin/events/:eventId/tournament-rules
 */
export const updateTournamentRules = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { eventId } = req.params;
    const rules: Partial<TournamentRules> = req.body;
    const userId = req.user!.id;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundError('Event not found');
    }

    // 기존 규칙과 병합
    const existingRules = phase2UnlockService.parseTournamentRules(event.tournamentRules);
    const newRules = { ...existingRules, ...rules };

    // 유효성 검증
    if (newRules.chestReservedSide && !['LEFT', 'RIGHT', 'NONE'].includes(newRules.chestReservedSide)) {
      throw new BadRequestError('Invalid chestReservedSide value');
    }
    if (newRules.sleeveReservedSide && !['LEFT', 'RIGHT', 'NONE'].includes(newRules.sleeveReservedSide)) {
      throw new BadRequestError('Invalid sleeveReservedSide value');
    }
    if (newRules.phase2UnlockMode && !['AUTO', 'ADMIN_APPROVE'].includes(newRules.phase2UnlockMode)) {
      throw new BadRequestError('Invalid phase2UnlockMode value');
    }

    // 업데이트
    await prisma.event.update({
      where: { id: eventId },
      data: {
        tournamentRules: newRules as any,
      },
    });

    // 감사 로그
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'UPDATE_TOURNAMENT_RULES',
        entityType: 'EVENT',
        entityId: eventId,
        oldValue: existingRules as any,
        newValue: newRules as any,
      },
    });

    return sendSuccess(res, {
      message: 'Tournament rules updated',
      rules: newRules,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 선수의 슬롯 가용성 조회
 * GET /api/events/:eventId/athletes/:athleteId/slot-availability
 */
export const getSlotAvailability = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { eventId, athleteId } = req.params;

    const availability = await phase2UnlockService.getSlotAvailabilityForEvent(eventId, athleteId);

    return sendSuccess(res, availability);
  } catch (error) {
    next(error);
  }
};

/**
 * Phase 2 슬롯 수동 승인 (Admin)
 * POST /api/admin/events/:eventId/athletes/:athleteId/approve-phase2
 */
export const approvePhase2Slots = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { eventId, athleteId } = req.params;
    const userId = req.user!.id;

    const result = await phase2UnlockService.approvePhase2Slots(eventId, athleteId, userId);

    return sendSuccess(res, {
      message: 'Phase 2 slots approved and created',
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 슬롯 템플릿 목록 조회 (v2 필드 포함)
 * GET /api/slot-templates
 */
export const getSlotTemplates = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { phase, category, grade } = req.query;

    const where: any = { isActive: true };
    if (phase) where.phase = parseInt(phase as string);
    if (category) where.category = category;
    if (grade) where.grade = grade;

    const templates = await prisma.slotTemplate.findMany({
      where,
      orderBy: [{ phase: 'asc' }, { code: 'asc' }],
    });

    return sendSuccess(res, {
      templates,
      total: templates.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 대회별 슬롯 상태 요약 (Admin)
 * GET /api/admin/events/:eventId/slot-summary
 */
export const getEventSlotSummary = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { eventId } = req.params;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        slotInstances: {
          include: {
            athlete: { select: { id: true, name: true } },
            slotTemplate: true,
            auction: {
              select: { id: true, status: true, currentPrice: true },
            },
          },
        },
        participations: {
          include: {
            athlete: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundError('Event not found');
    }

    const rules = phase2UnlockService.parseTournamentRules(event.tournamentRules);

    // 선수별 Phase 2 eligible 상태 계산
    const athleteStatuses = await Promise.all(
      event.participations.map(async (p) => {
        const availability = await phase2UnlockService.getSlotAvailabilityForEvent(
          eventId,
          p.athleteId
        );
        return {
          athlete: p.athlete,
          isPhase2Eligible: availability.isPhase2Eligible,
          openableCount: availability.openableSlots.length,
          soldCount: availability.soldSlots.length,
          reservedCount: availability.reservedSlots.length,
        };
      })
    );

    return sendSuccess(res, {
      event: {
        id: event.id,
        name: event.name,
        dateStart: event.dateStart,
        dateEnd: event.dateEnd,
      },
      rules,
      slotInstanceCount: event.slotInstances.length,
      athleteStatuses,
      phase2EligibleAthletes: athleteStatuses.filter((s) => s.isPhase2Eligible),
    });
  } catch (error) {
    next(error);
  }
};
