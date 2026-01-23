import { Router } from 'express';
import { eventController } from '../controllers/event.controller';
import { authenticate, authorize, optionalAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createEventSchema } from '../utils/validation';

const router = Router();

/**
 * @route GET /events
 * @desc List events with filters (public - non-logged-in users can view)
 */
router.get('/', optionalAuth, eventController.list);

/**
 * @route GET /events/upcoming
 * @desc Get upcoming events (public - non-logged-in users can view)
 */
router.get('/upcoming', optionalAuth, eventController.getUpcoming);

/**
 * @route POST /events
 * @desc Create new event (admin only)
 */
router.post(
  '/',
  authenticate,
  authorize('ADMIN'),
  validate(createEventSchema),
  eventController.create
);

/**
 * @route GET /events/:id
 * @desc Get event by ID (public - non-logged-in users can view)
 */
router.get('/:id', optionalAuth, eventController.getById);

/**
 * @route PATCH /events/:id
 * @desc Update event (admin only)
 */
router.patch('/:id', authenticate, authorize('ADMIN'), eventController.update);

/**
 * @route DELETE /events/:id
 * @desc Delete event (admin only)
 */
router.delete('/:id', authenticate, authorize('ADMIN'), eventController.delete);

/**
 * @route POST /events/:id/participants
 * @desc Add participant to event (admin only)
 */
router.post(
  '/:id/participants',
  authenticate,
  authorize('ADMIN'),
  eventController.addParticipant
);

/**
 * @route POST /events/:id/confirm
 * @desc Confirm participation (athlete)
 */
router.post(
  '/:id/confirm',
  authenticate,
  authorize('ATHLETE'),
  eventController.confirmParticipation
);

export default router;
