import { z } from 'zod';

// Auth Schemas
export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['BRAND', 'ATHLETE', 'ADMIN']),
  name: z.string().min(1, 'Name is required'),
  tour: z.string().optional(),
  category: z.string().optional(),
  bizNo: z.string().optional(),
});

// Brand Schemas
export const createBrandSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  bizNo: z.string().optional(),
  category: z.string().min(1, 'Category is required'),
  contactEmail: z.string().email('Invalid email format'),
  contactPhone: z.string().optional(),
});

// Athlete Schemas
export const createAthleteSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  tour: z.string().min(1, 'Tour is required'),
  contactEmail: z.string().email('Invalid email format'),
  bio: z.string().optional(),
  socialLinks: z.record(z.string()).optional(),
});

// Event Schemas
export const createEventSchema = z.object({
  tour: z.string().min(1, 'Tour is required'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  dateStart: z.string().datetime(),
  dateEnd: z.string().datetime(),
  broadcastEpisode: z.string().optional(),
  multiplier: z.number().positive().default(1.0),
  venue: z.string().optional(),
});

// Slot Template Schemas
export const createSlotTemplateSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  name: z.string().min(1, 'Name is required'),
  bodyPart: z.enum([
    'SHIRT_CHEST_LEFT',
    'SHIRT_CHEST_RIGHT',
    'SHIRT_SLEEVE_LEFT',
    'SHIRT_SLEEVE_RIGHT',
    'CAP_SIDE_LEFT',
    'CAP_BACK',
    'PANTS_BELT',
    'SHIRT_BACK',
  ]),
  sizeMaxWMm: z.number().int().positive(),
  sizeMaxHMm: z.number().int().positive(),
  perimeterMaxMm: z.number().int().positive(),
  recommendedWMm: z.number().int().positive().optional(),
  recommendedHMm: z.number().int().positive().optional(),
  forbiddenNotes: z.string().optional(),
  materialRules: z.enum(['PRINTED_ONLY', 'EMBROIDERY_OK', 'ANY']).default('PRINTED_ONLY'),
  requiredAngles: z.array(z.string()).default(['front']),
  categoryExclusivityGroup: z.string().optional(),
  defaultReservePrice: z.number().int().nonnegative(),
});

// Slot Instance Schemas
export const createSlotInstanceSchema = z.object({
  eventId: z.string().uuid(),
  athleteId: z.string().uuid(),
  slotTemplateId: z.string().uuid(),
  reservePrice: z.number().int().nonnegative().optional(),
});

// Auction Schemas
export const createAuctionSchema = z.object({
  slotInstanceId: z.string().uuid(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  softCloseSec: z.number().int().positive().optional(),
  maxExtensionSec: z.number().int().positive().optional(),
  minBidIncrement: z.number().int().positive().optional(),
});

// Bid Schemas
export const placeBidSchema = z.object({
  maxBid: z.number().int().positive('Max bid must be positive'),
  autoBid: z.boolean().default(true),
});

// Contract Schemas
export const createContractSchema = z.object({
  auctionId: z.string().uuid(),
  brandId: z.string().uuid(),
  athleteId: z.string().uuid(),
  priceFinal: z.number().int().positive(),
});

// Creative Asset Schemas
export const uploadAssetSchema = z.object({
  fileUrl: z.string().url('Invalid file URL'),
  fileName: z.string().optional(),
  fileType: z.string().optional(),
  notes: z.string().optional(),
});

// Verification Schemas
export const submitVerificationSchema = z.object({
  photoUrls: z.array(z.string().url()).min(1, 'At least one photo is required'),
  angles: z.array(z.enum(['front', 'side', 'back'])).default(['front']),
});

// Query Schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const eventQuerySchema = paginationSchema.extend({
  tour: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  status: z.enum(['UPCOMING', 'LIVE', 'COMPLETED', 'CANCELLED']).optional(),
});

export const slotInstanceQuerySchema = paginationSchema.extend({
  eventId: z.string().uuid().optional(),
  athleteId: z.string().uuid().optional(),
  slotCode: z.string().optional(),
  status: z.enum(['OPEN', 'IN_AUCTION', 'SOLD', 'CLOSED']).optional(),
});

export const auctionQuerySchema = paginationSchema.extend({
  status: z.enum(['SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED', 'UNSOLD']).optional(),
  eventId: z.string().uuid().optional(),
  athleteId: z.string().uuid().optional(),
});
