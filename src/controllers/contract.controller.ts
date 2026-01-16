import { Response, NextFunction } from 'express';
import { contractService, creativeAssetService, verificationService } from '../services/contract.service';
import { settlementService } from '../services/settlement.service';
import { sendSuccess, sendPaginated } from '../utils/response';
import { AuthRequest } from '../types';

export class ContractController {
  async createFromAuction(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { auctionId } = req.body;
      const contract = await contractService.createFromAuction(auctionId);
      sendSuccess(res, contract, 201);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const contract = await contractService.findById(id);
      sendSuccess(res, contract);
    } catch (error) {
      next(error);
    }
  }

  async list(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = 1, limit = 20, brandId, athleteId, status } = req.query;
      const { contracts, total } = await contractService.list({
        brandId: brandId as string,
        athleteId: athleteId as string,
        status: status as any,
        page: Number(page),
        limit: Number(limit),
      });
      sendPaginated(res, contracts, Number(page), Number(limit), total);
    } catch (error) {
      next(error);
    }
  }

  async getMyContracts(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      let contracts;
      if (req.user?.role === 'BRAND' && req.user.brandId) {
        contracts = await contractService.getByBrand(req.user.brandId);
      } else if (req.user?.role === 'ATHLETE' && req.user.athleteId) {
        contracts = await contractService.getByAthlete(req.user.athleteId);
      } else {
        throw new Error('No associated profile found');
      }
      sendSuccess(res, contracts);
    } catch (error) {
      next(error);
    }
  }

  async sign(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userType = req.user?.role === 'BRAND' ? 'brand' : 'athlete';
      const contract = await contractService.sign(id, req.user!.id, userType);
      sendSuccess(res, contract);
    } catch (error) {
      next(error);
    }
  }

  async cancel(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const contract = await contractService.cancel(id, reason);
      sendSuccess(res, contract);
    } catch (error) {
      next(error);
    }
  }

  // Creative Assets
  async uploadAsset(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const asset = await creativeAssetService.upload(id, req.body);
      sendSuccess(res, asset, 201);
    } catch (error) {
      next(error);
    }
  }

  async getAssets(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const assets = await creativeAssetService.getByContract(id);
      sendSuccess(res, assets);
    } catch (error) {
      next(error);
    }
  }

  async reviewAsset(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { assetId } = req.params;
      const { status, notes } = req.body;
      const asset = await creativeAssetService.review(assetId, status, req.user!.id, notes);
      sendSuccess(res, asset);
    } catch (error) {
      next(error);
    }
  }

  // Verification
  async submitVerification(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const verification = await verificationService.submit(id, req.body);
      sendSuccess(res, verification, 201);
    } catch (error) {
      next(error);
    }
  }

  async getVerification(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const verification = await verificationService.getByContract(id);
      sendSuccess(res, verification);
    } catch (error) {
      next(error);
    }
  }

  async reviewVerification(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { verificationId } = req.params;
      const { status, rejectionReason } = req.body;
      const verification = await verificationService.review(
        verificationId,
        status,
        req.user!.id,
        rejectionReason
      );
      sendSuccess(res, verification);
    } catch (error) {
      next(error);
    }
  }

  // Report
  async getReport(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const contract = await contractService.findById(id);

      const report = {
        contractId: contract.id,
        eventId: contract.auction.slotInstance.event.id,
        eventName: contract.auction.slotInstance.event.name,
        athleteId: contract.athlete.id,
        athleteName: contract.athlete.name,
        slotCode: contract.auction.slotInstance.slotTemplate.code,
        brandId: contract.brand.id,
        brandName: contract.brand.name,
        priceFinal: contract.priceFinal,
        status: contract.status,
        verified: contract.verification?.status === 'VERIFIED',
        evidence: {
          assets: contract.assets,
          verification: contract.verification,
        },
        settlement: contract.settlement,
      };

      sendSuccess(res, report);
    } catch (error) {
      next(error);
    }
  }
}

export class SettlementController {
  async list(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = 1, limit = 20, status, athleteId } = req.query;
      const { settlements, total } = await settlementService.list({
        status: status as any,
        athleteId: athleteId as string,
        page: Number(page),
        limit: Number(limit),
      });
      sendPaginated(res, settlements, Number(page), Number(limit), total);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const settlement = await settlementService.findById(id);
      sendSuccess(res, settlement);
    } catch (error) {
      next(error);
    }
  }

  async getMySettlements(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.athleteId) {
        throw new Error('No athlete associated');
      }
      const settlements = await settlementService.getByAthlete(req.user.athleteId);
      sendSuccess(res, settlements);
    } catch (error) {
      next(error);
    }
  }

  async getMyStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.athleteId) {
        throw new Error('No athlete associated');
      }
      const stats = await settlementService.getAthleteStats(req.user.athleteId);
      sendSuccess(res, stats);
    } catch (error) {
      next(error);
    }
  }

  async processPayment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { paymentRef } = req.body;
      const settlement = await settlementService.processPayment(id, paymentRef);
      sendSuccess(res, settlement);
    } catch (error) {
      next(error);
    }
  }

  async getMonthlySettlements(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.athleteId) {
        throw new Error('No athlete associated');
      }
      const monthly = await settlementService.getMonthlySettlements(req.user.athleteId);
      sendSuccess(res, monthly);
    } catch (error) {
      next(error);
    }
  }

  async downloadReport(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.athleteId) {
        throw new Error('No athlete associated');
      }
      const { year, month } = req.query;
      const report = await settlementService.generateReport(
        req.user.athleteId,
        Number(year) || new Date().getFullYear(),
        Number(month) || new Date().getMonth() + 1
      );

      // Return as JSON for now, can be converted to PDF/CSV in frontend
      sendSuccess(res, report);
    } catch (error) {
      next(error);
    }
  }
}

export const contractController = new ContractController();
export const settlementController = new SettlementController();
