import { Request } from 'express';
import { UserRole } from '@prisma/client';

// Extended Request with User
export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
    brandId?: string;
    athleteId?: string;
    adminId?: string;
  };
}

// Alias for backward compatibility
export type AuthenticatedRequest = AuthRequest;

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Auth Types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    role: UserRole;
  };
}

export interface RegisterRequest {
  email: string;
  password: string;
  role: UserRole;
  name: string;
  tour?: string; // For athletes
  category?: string; // For brands
  bizNo?: string; // For brands
}

// Brand Types
export interface CreateBrandRequest {
  name: string;
  bizNo?: string;
  category: string;
  contactEmail: string;
  contactPhone?: string;
}

// Athlete Types
export interface CreateAthleteRequest {
  name: string;
  tour: string;
  contactEmail: string;
  bio?: string;
  socialLinks?: Record<string, string>;
}

// Event Types
export interface CreateEventRequest {
  tour: string;
  name: string;
  description?: string;
  dateStart: Date;
  dateEnd: Date;
  broadcastEpisode?: string;
  multiplier?: number;
  venue?: string;
}

// Slot Types
export interface CreateSlotTemplateRequest {
  code: string;
  name: string;
  bodyPart: string;
  sizeMaxWMm: number;
  sizeMaxHMm: number;
  perimeterMaxMm: number;
  recommendedWMm?: number;
  recommendedHMm?: number;
  forbiddenNotes?: string;
  materialRules?: string;
  requiredAngles?: string[];
  categoryExclusivityGroup?: string;
  defaultReservePrice: number;
}

export interface CreateSlotInstanceRequest {
  eventId: string;
  athleteId: string;
  slotTemplateId: string;
  reservePrice?: number;
}

// Auction Types
export interface CreateAuctionRequest {
  slotInstanceId: string;
  startAt: Date;
  endAt: Date;
  softCloseSec?: number;
  maxExtensionSec?: number;
  minBidIncrement?: number;
}

// Bid Types
export interface PlaceBidRequest {
  maxBid: number;
  autoBid?: boolean;
}

export interface BidResult {
  bidId: string;
  auctionId: string;
  brandId: string;
  maxBid: number;
  effectiveCurrentPrice: number;
  rank: number;
  isWinning: boolean;
}

// Contract Types
export interface CreateContractRequest {
  auctionId: string;
  brandId: string;
  athleteId: string;
  priceFinal: number;
}

// Creative Asset Types
export interface UploadAssetRequest {
  fileUrl: string;
  fileName?: string;
  fileType?: string;
  notes?: string;
}

// Verification Types
export interface SubmitVerificationRequest {
  photoUrls: string[];
  angles: string[];
}

// Query Filters
export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface EventQuery extends PaginationQuery {
  tour?: string;
  from?: string;
  to?: string;
  status?: string;
}

export interface SlotInstanceQuery extends PaginationQuery {
  eventId?: string;
  athleteId?: string;
  slotCode?: string;
  status?: string;
}

export interface AuctionQuery extends PaginationQuery {
  status?: string;
  eventId?: string;
  athleteId?: string;
}
