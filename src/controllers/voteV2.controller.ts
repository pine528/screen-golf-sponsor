import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { voteV2Service, VOTE_TEMPLATES, TemplateCode, USER_VOTE_LIMITS } from '../services/voteV2.service';
import { rewardPoolService } from '../services/rewardPool.service';
import { VoteV2Status } from '@prisma/client';

/**
 * 리워드풀 상태 조회
 */
export const getRewardPoolStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const status = await rewardPoolService.getStatus();

    res.json({
      success: true,
      data: {
        ...status,
        // BigInt를 문자열로 변환 (JSON 직렬화)
        balanceEp: status.balanceEp.toString(),
        reservedEp: status.reservedEp.toString(),
        availableTodayEp: status.availableTodayEp.toString(),
        availableEp: status.availableEp.toString(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 리워드풀 충전 (관리자)
 */
export const depositToRewardPool = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { amount, reason } = req.body;
    const adminId = req.user!.id;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: { message: '유효한 금액을 입력해주세요' },
      });
    }

    await rewardPoolService.adminDeposit(Number(amount), adminId, reason);

    const status = await rewardPoolService.getStatus();

    res.json({
      success: true,
      message: `${amount} EP가 리워드풀에 충전되었습니다`,
      data: {
        balanceEp: status.balanceEp.toString(),
        reservedEp: status.reservedEp.toString(),
        availableEp: status.availableEp.toString(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 일일 가용액 리셋 (관리자/크론)
 */
export const resetDailyAvailable = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { percentage } = req.body;
    const todayAvailable = await rewardPoolService.resetDailyAvailable(percentage || 5);

    res.json({
      success: true,
      message: '일일 가용액이 리셋되었습니다',
      data: {
        availableTodayEp: todayAvailable.toString(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 배수 M 재계산 (관리자/크론)
 */
export const recalculateMultiplier = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const newMultiplier = await rewardPoolService.recalculateMultiplier();

    res.json({
      success: true,
      message: '배수가 재계산되었습니다',
      data: {
        multiplierM: newMultiplier,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 투표 목록 조회
 */
export const listVotes = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { status, page, pageSize } = req.query;

    const result = await voteV2Service.list({
      status: status as VoteV2Status | undefined,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });

    // BigInt 변환
    const votes = result.votes.map((vote) => ({
      ...vote,
      rewardBudgetEp: vote.rewardBudgetEp.toString(),
      escrowEp: vote.escrowEp.toString(),
      maxPerWinnerEp: vote.maxPerWinnerEp.toString(),
    }));

    res.json({
      success: true,
      data: votes,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 투표 상세 조회
 */
export const getVoteById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const vote = await voteV2Service.getById(id, userId);

    // BigInt 필드와 participations 배열 제외하고 스프레드
    const { rewardBudgetEp, escrowEp, maxPerWinnerEp, participations, _count, ...rest } = vote as any;

    // BigInt 변환
    const data = {
      ...rest,
      rewardBudgetEp: rewardBudgetEp.toString(),
      escrowEp: escrowEp.toString(),
      maxPerWinnerEp: maxPerWinnerEp.toString(),
      userParticipation: vote.userParticipation
        ? {
            voteId: vote.userParticipation.voteId,
            userId: vote.userParticipation.userId,
            answer: vote.userParticipation.answer,
            isCorrect: vote.userParticipation.isCorrect,
            microRewardPaidEp: vote.userParticipation.microRewardPaidEp.toString(),
            finalRewardPaidEp: vote.userParticipation.finalRewardPaidEp.toString(),
            createdAt: vote.userParticipation.createdAt,
          }
        : null,
    };

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 투표 생성 (관리자)
 */
export const createVote = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { templateCode, title, description, options, closeAt, target, outcomeSource, maxPerWinnerEp } =
      req.body;
    const createdBy = req.user!.id;

    // 필수 필드 검증
    if (!templateCode || !title || !closeAt) {
      return res.status(400).json({
        success: false,
        error: { message: '템플릿 코드, 제목, 마감일은 필수입니다' },
      });
    }

    // 템플릿 코드 검증
    if (!VOTE_TEMPLATES[templateCode as TemplateCode]) {
      return res.status(400).json({
        success: false,
        error: {
          message: `유효하지 않은 템플릿 코드입니다. 사용 가능: ${Object.keys(VOTE_TEMPLATES).join(', ')}`,
        },
      });
    }

    const vote = await voteV2Service.create(
      {
        templateCode: templateCode as TemplateCode,
        title,
        description,
        options: options || [],
        closeAt: new Date(closeAt),
        target,
        outcomeSource,
        maxPerWinnerEp,
      },
      createdBy
    );

    res.status(201).json({
      success: true,
      data: {
        ...vote,
        rewardBudgetEp: vote.rewardBudgetEp.toString(),
        escrowEp: vote.escrowEp.toString(),
        maxPerWinnerEp: vote.maxPerWinnerEp.toString(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 투표 참여 (무료)
 */
export const participateVote = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { answer } = req.body;

    if (answer === undefined) {
      return res.status(400).json({
        success: false,
        error: { message: '답변을 선택해주세요' },
      });
    }

    const result = await voteV2Service.participate(id, userId, { answer });

    res.json({
      success: true,
      message: '투표에 참여했습니다',
      data: {
        participation: {
          ...result.participation,
          microRewardPaidEp: result.participation.microRewardPaidEp.toString(),
          finalRewardPaidEp: result.participation.finalRewardPaidEp.toString(),
        },
        microRewardPaid: result.microRewardPaid,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 투표 정산 (관리자)
 */
export const settleVote = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { correctAnswer } = req.body;

    if (correctAnswer === undefined) {
      return res.status(400).json({
        success: false,
        error: { message: '정답을 입력해주세요' },
      });
    }

    const result = await voteV2Service.settle(id, { correctAnswer });

    if (result.alreadySettled) {
      return res.json({
        success: true,
        message: '이미 정산된 투표입니다',
        data: result,
      });
    }

    res.json({
      success: true,
      message: '투표가 정산되었습니다',
      data: {
        winnersCount: result.winnersCount,
        perWinnerEp: result.perWinnerEp.toString(),
        totalPaidEp: result.totalPaidEp.toString(),
        remainderEp: result.remainderEp.toString(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 투표 취소 (관리자)
 */
export const cancelVote = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    await voteV2Service.cancel(id);

    res.json({
      success: true,
      message: '투표가 취소되었습니다. 에스크로가 풀로 반환되었습니다.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 만료된 투표 마감 (크론)
 */
export const closeExpiredVotes = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const count = await voteV2Service.closeExpiredVotes();

    res.json({
      success: true,
      message: `${count}개 투표가 마감되었습니다`,
      data: { closedCount: count },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 내 참여 목록 조회
 */
export const getMyParticipations = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user!.id;
    const { page, pageSize } = req.query;

    const result = await voteV2Service.getMyParticipations(userId, {
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });

    // BigInt 변환
    const participations = result.participations.map((p) => ({
      ...p,
      microRewardPaidEp: p.microRewardPaidEp.toString(),
      finalRewardPaidEp: p.finalRewardPaidEp.toString(),
    }));

    res.json({
      success: true,
      data: participations,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 투표 통계 (관리자)
 */
export const getVoteStats = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const stats = await voteV2Service.getStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 템플릿 목록 조회
 */
export const getTemplates = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const templates = Object.entries(VOTE_TEMPLATES).map(([code, info]) => ({
      code,
      name: info.name,
      baseBudget: info.base,
      difficulty: info.difficulty,
    }));

    res.json({
      success: true,
      data: templates,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// 사용자 투표 생성 (본인 포인트 사용)
// ============================================

/**
 * 사용자 투표 생성 제한 정보 조회
 */
export const getUserVoteLimits = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    res.json({
      success: true,
      data: {
        minSeedEp: USER_VOTE_LIMITS.MIN_SEED_EP,
        maxSeedEp: USER_VOTE_LIMITS.MAX_SEED_EP,
        maxDailyCreates: USER_VOTE_LIMITS.MAX_DAILY_CREATES,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 사용자 투표 생성 (본인 포인트 사용)
 */
export const createUserVote = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { templateCode, title, description, options, closeAt, seedAmountEp, target } = req.body;
    const createdBy = req.user!.id;

    // 필수 필드 검증
    if (!templateCode || !title || !closeAt || !seedAmountEp) {
      return res.status(400).json({
        success: false,
        error: { message: '템플릿 코드, 제목, 마감일, 시드머니는 필수입니다' },
      });
    }

    // 템플릿 코드 검증
    if (!VOTE_TEMPLATES[templateCode as TemplateCode]) {
      return res.status(400).json({
        success: false,
        error: {
          message: `유효하지 않은 템플릿 코드입니다. 사용 가능: ${Object.keys(VOTE_TEMPLATES).join(', ')}`,
        },
      });
    }

    // 선택지 검증 (T1-YesNo 제외)
    if (templateCode !== 'T1-YesNo' && (!options || options.length < 2)) {
      return res.status(400).json({
        success: false,
        error: { message: '최소 2개 이상의 선택지가 필요합니다' },
      });
    }

    const vote = await voteV2Service.createUserVote(
      {
        templateCode: templateCode as TemplateCode,
        title,
        description,
        options: templateCode === 'T1-YesNo'
          ? [{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }]
          : options,
        closeAt: new Date(closeAt),
        seedAmountEp: Number(seedAmountEp),
        target,
      },
      createdBy
    );

    res.status(201).json({
      success: true,
      message: `투표가 생성되었습니다. ${seedAmountEp.toLocaleString()} EP가 차감되었습니다.`,
      data: {
        ...vote,
        rewardBudgetEp: vote.rewardBudgetEp.toString(),
        escrowEp: vote.escrowEp.toString(),
        maxPerWinnerEp: vote.maxPerWinnerEp.toString(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 내가 생성한 투표 목록 조회
 */
export const getMyCreatedVotes = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user!.id;
    const { status, page, pageSize } = req.query;

    const result = await voteV2Service.getMyCreatedVotes(userId, {
      status: status as VoteV2Status | undefined,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });

    // BigInt 변환
    const votes = result.votes.map((vote) => ({
      ...vote,
      rewardBudgetEp: vote.rewardBudgetEp.toString(),
      escrowEp: vote.escrowEp.toString(),
      maxPerWinnerEp: vote.maxPerWinnerEp.toString(),
    }));

    res.json({
      success: true,
      data: votes,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 사용자 투표 취소 (생성자만, 참여자 없을 때)
 */
export const cancelUserVote = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    await voteV2Service.cancelUserVote(id, userId);

    res.json({
      success: true,
      message: '투표가 취소되었습니다. 시드머니가 환불되었습니다.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 사용자 투표 정산 (생성자)
 */
export const settleUserVote = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { correctAnswer } = req.body;
    const isAdmin = req.user?.role === 'ADMIN';

    if (correctAnswer === undefined) {
      return res.status(400).json({
        success: false,
        error: { message: '정답을 입력해주세요' },
      });
    }

    const result = await voteV2Service.settleUserVote(id, userId, { correctAnswer }, isAdmin);

    if (result.alreadySettled) {
      return res.json({
        success: true,
        message: '이미 정산된 투표입니다',
        data: result,
      });
    }

    res.json({
      success: true,
      message: '투표가 정산되었습니다',
      data: {
        winnersCount: result.winnersCount,
        perWinnerEp: result.perWinnerEp.toString(),
        totalPaidEp: result.totalPaidEp.toString(),
        remainderEp: result.remainderEp.toString(),
      },
    });
  } catch (error) {
    next(error);
  }
};
