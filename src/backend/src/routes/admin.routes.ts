import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createSlotTemplateSchema } from '../utils/validation';

const router = Router();

// All admin routes require authentication and ADMIN role
router.use(authenticate, authorize('ADMIN'));

// ============================================
// Dashboard
// ============================================

/**
 * @route GET /admin/dashboard
 * @desc Get admin dashboard statistics
 */
router.get('/dashboard', adminController.getDashboard);

// ============================================
// KYC Management
// ============================================

/**
 * @route GET /admin/kyc/pending
 * @desc Get pending KYC reviews
 */
router.get('/kyc/pending', adminController.getPendingKyc);

/**
 * @route POST /admin/kyc/brands/:brandId/review
 * @desc Review brand KYC
 */
router.post('/kyc/brands/:brandId/review', adminController.reviewBrandKyc);

/**
 * @route POST /admin/kyc/athletes/:athleteId/review
 * @desc Review athlete KYC
 */
router.post('/kyc/athletes/:athleteId/review', adminController.reviewAthleteKyc);

// ============================================
// Slot Templates
// ============================================

/**
 * @route POST /admin/slot-templates
 * @desc Create slot template
 */
router.post(
  '/slot-templates',
  validate(createSlotTemplateSchema),
  adminController.createSlotTemplate
);

/**
 * @route PATCH /admin/slot-templates/:id
 * @desc Update slot template
 */
router.patch('/slot-templates/:id', adminController.updateSlotTemplate);

// ============================================
// Forbidden Categories
// ============================================

/**
 * @route GET /admin/forbidden-categories
 * @desc Get all forbidden categories
 */
router.get('/forbidden-categories', adminController.getForbiddenCategories);

/**
 * @route POST /admin/forbidden-categories
 * @desc Create forbidden category
 */
router.post('/forbidden-categories', adminController.createForbiddenCategory);

/**
 * @route PATCH /admin/forbidden-categories/:id
 * @desc Update forbidden category
 */
router.patch('/forbidden-categories/:id', adminController.updateForbiddenCategory);

// ============================================
// Category Mappings
// ============================================

/**
 * @route GET /admin/category-mappings
 * @desc Get all category mappings
 */
router.get('/category-mappings', adminController.getCategoryMappings);

/**
 * @route POST /admin/category-mappings
 * @desc Create category mapping
 */
router.post('/category-mappings', adminController.createCategoryMapping);

/**
 * @route DELETE /admin/category-mappings/:id
 * @desc Delete category mapping
 */
router.delete('/category-mappings/:id', adminController.deleteCategoryMapping);

// ============================================
// Audit Logs
// ============================================

/**
 * @route GET /admin/audit-logs
 * @desc Get audit logs with filters
 */
router.get('/audit-logs', adminController.getAuditLogs);

// ============================================
// Monitoring
// ============================================

/**
 * @route GET /admin/monitoring/auctions
 * @desc Get auction monitoring data
 */
router.get('/monitoring/auctions', adminController.getAuctionMonitoring);

/**
 * @route GET /admin/monitoring/pending-reviews
 * @desc Get pending reviews (assets, verifications)
 */
router.get('/monitoring/pending-reviews', adminController.getPendingReviews);

// ============================================
// User Management
// ============================================

/**
 * @route GET /admin/users
 * @desc Get users with filters
 */
router.get('/users', adminController.getUsers);

/**
 * @route POST /admin/users/:userId/toggle-active
 * @desc Toggle user active status
 */
router.post('/users/:userId/toggle-active', adminController.toggleUserActive);

// ============================================
// System Settings
// ============================================

/**
 * @route GET /admin/settings
 * @desc Get all system settings
 */
router.get('/settings', adminController.getSettings);

/**
 * @route PATCH /admin/settings/:key
 * @desc Update system setting
 */
router.patch('/settings/:key', adminController.updateSetting);

// ============================================
// Brand Registration Requests
// ============================================

/**
 * @route GET /admin/brand-registrations
 * @desc Get brand registration requests with filters
 */
router.get('/brand-registrations', adminController.getBrandRegistrations);

/**
 * @route POST /admin/brand-registrations/:id/approve
 * @desc Approve brand registration request
 */
router.post('/brand-registrations/:id/approve', adminController.approveBrandRegistration);

/**
 * @route POST /admin/brand-registrations/:id/reject
 * @desc Reject brand registration request
 */
router.post('/brand-registrations/:id/reject', adminController.rejectBrandRegistration);

export default router;
