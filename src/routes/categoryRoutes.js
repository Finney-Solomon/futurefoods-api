// src/routes/categoryRoutes.js
import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { list, create, update, remove } from '../controllers/categoryController.js';

const router = Router();
router.get('/', list);
router.post('/', auth, requireRole('admin'), create);
router.put('/:id', auth, requireRole('admin'), update);
router.delete('/:id', auth, requireRole('admin'), remove);
export default router;