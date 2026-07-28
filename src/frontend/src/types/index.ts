// User Types
export type UserRole = 'BRAND' | 'ATHLETE' | 'ADMIN' | 'FAN' | 'AGENCY';
export type KycStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface User {
  id: string;
  email: string;
  role: UserRole;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
}

export interface RegisterData {
  email: string;
  password: string;
  role: UserRole;
  name?: string;
  nickname?: string;
  tour?: string;
  category?: string;
  bizNo?: string;
  contactName?: string;
  contactPhone?: string;
  certificationToken?: string; // 본인인증 토큰 (BRAND, ATHLETE, AGENCY 필수)
}

// Brand Types
export interface Brand {
  id: string;
  name: string;
  bizNo?: string;
  category: string;
  contactEmail: string;
  kycStatus: KycStatus;
  penaltyScore: number;
}

// Athlete Types
export interface Athlete {
  id: string;
  name: string;
  tour: string;
  profileImageUrl?: string;
  bio?: string;
  blockedCategories: string[];
  kycStatus: KycStatus;
}

// Event Types
export type EventStatus = 'UPCOMING' | 'LIVE' | 'COMPLETED' | 'CANCELLED';

export interface Event {
  id: string;
  tour: string;
  name: string;
  description?: string;
  dateStart: string;
  dateEnd: string;
  broadcastEpisode?: string;
  multiplier: number;
  venue?: string;
  status: EventStatus;
  tournamentRules?: TournamentRules;
  _count?: {
    slotInstances: number;
    participations: number;
  };
}

// Slot Types
export type BodyPart =
  | 'SHIRT_CHEST_LEFT'
  | 'SHIRT_CHEST_RIGHT'
  | 'SHIRT_SLEEVE_LEFT'
  | 'SHIRT_SLEEVE_RIGHT'
  | 'CAP_SIDE_LEFT'
  | 'CAP_BACK'
  | 'PANTS_BELT'
  | 'SHIRT_BACK'
  // v2 Body Parts
  | 'CAP_FRONT'
  | 'CAP_BRIM_TOP'
  | 'CAP_SIDE_L'
  | 'CAP_SIDE_R'
  | 'CHEST_L'
  | 'CHEST_R'
  | 'COLLAR_L'
  | 'COLLAR_R'
  | 'SLEEVE_L'
  | 'SLEEVE_R'
  | 'BACK_SHOULDER_L'
  | 'BACK_SHOULDER_R'
  | 'PANTS_HIP_SIDE_FACING'
  | 'PANTS_THIGH_SIDE_FACING';

export type SlotStatus = 'OPEN' | 'IN_AUCTION' | 'SOLD' | 'CLOSED' | 'RESERVED' | 'DISABLED';

export type SlotGrade = 'S' | 'A' | 'B' | 'C';
export type SlotCategory = 'CAP' | 'TOP' | 'PANTS';

export interface SlotTemplate {
  id: string;
  code: string;
  name: string;
  bodyPart: BodyPart;
  sizeMaxWMm: number;
  sizeMaxHMm: number;
  perimeterMaxMm: number;
  recommendedWMm?: number;
  recommendedHMm?: number;
  forbiddenNotes?: string;
  defaultReservePrice: number;
  // v2 Phase Policy Fields
  phase?: number;
  category?: SlotCategory;
  grade?: SlotGrade;
  nameKr?: string;
  nameEn?: string;
  uiHeadline?: string;
  uiCopy?: string;
  tags?: string[];
  openRule?: string;
  exclusivityGroup?: string;
  tournamentReserved?: boolean;
  recSizeMm?: string;
  material?: string;
  reserveMinKrw?: number;
  reserveRecKrw?: number;
  reserveReason?: string;
}

// Tournament Rules Types
export interface TournamentRules {
  chestReservedSide: 'LEFT' | 'RIGHT' | 'NONE';
  sleeveReservedSide: 'LEFT' | 'RIGHT' | 'NONE';
  reservedSlotCodes: string[];
  disabledSlotCodes: string[];
  phase2UnlockPolicy: 'ALL_PHASE1_EFFECTIVE_SLOTS_FILLED';
  phase2UnlockMode: 'AUTO' | 'ADMIN_APPROVE';
  phase2EligibleMinDaysBefore: number;
  creativeApprovalRequired: boolean;
  prohibitedCategories: string[];
  maxSlotsPerBrandPerPlayer: number;
}

export interface SlotAvailability {
  slotCode: string;
  slotName: string;
  nameKr?: string;
  nameEn?: string;
  phase: number;
  grade?: SlotGrade;
  uiHeadline?: string;
  uiCopy?: string;
  tags?: string[];
  exclusivityGroup?: string;
  reserveMinKrw?: number;
  reserveRecKrw?: number;
  status: SlotStatus;
  canOpen: boolean;
  reason: string;
  hasInstance: boolean;
  instanceId?: string;
}

export interface SlotInstance {
  id: string;
  eventId: string;
  athleteId: string;
  slotTemplateId: string;
  reservePrice: number;
  status: SlotStatus;
  event?: Event;
  athlete?: Athlete;
  slotTemplate?: SlotTemplate;
  auction?: Auction;
}

// Auction Types
export type AuctionStatus = 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED' | 'UNSOLD';

export interface Auction {
  id: string;
  slotInstanceId: string;
  startAt: string;
  endAt: string;
  originalEndAt: string;
  softCloseSec: number;
  maxExtensionSec: number;
  totalExtended: number;
  minBidIncrement: number;
  currentPrice: number;
  status: AuctionStatus;
  slotInstance?: SlotInstance;
  bids?: Bid[];
  _count?: {
    bids: number;
  };
}

export interface Bid {
  id: string;
  auctionId: string;
  brandId: string;
  maxBid: number;
  currentProxy: number;
  autoBid: boolean;
  isWinning: boolean;
  createdAt: string;
  brand?: Brand;
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
export type ContractStatus =
  | 'PENDING_SIGNATURE'
  | 'ACTIVE'
  | 'ASSET_PENDING'
  | 'ASSET_APPROVED'
  | 'VERIFICATION_PENDING'
  | 'VERIFIED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface Contract {
  id: string;
  auctionId: string;
  brandId: string;
  athleteId: string;
  priceFinal: number;
  status: ContractStatus;
  signedAt?: string;
  assetDeadline?: string;
  auction?: Auction;
  brand?: Brand;
  athlete?: Athlete;
  assets?: CreativeAsset[];
  verification?: Verification;
  settlement?: Settlement;
}

export type AssetStatus = 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';

export interface CreativeAsset {
  id: string;
  contractId: string;
  fileUrl: string;
  fileName?: string;
  fileType?: string;
  status: AssetStatus;
  reviewNotes?: string;
}

export type VerificationStatus = 'SUBMITTED' | 'UNDER_REVIEW' | 'VERIFIED' | 'REJECTED';

export interface Verification {
  id: string;
  contractId: string;
  photoUrls: string[];
  angles: string[];
  status: VerificationStatus;
  rejectionReason?: string;
}

// Settlement Types
export type SettlementStatus = 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED' | 'REFUNDED';

export interface Settlement {
  id: string;
  contractId: string;
  grossAmount: number;
  platformFee: number;
  platformFeeRate: number;
  payoutAmount: number;
  status: SettlementStatus;
  paidAt?: string;
  paymentRef?: string;
}

// API Response Types
export interface ApiResponse<T> {
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
