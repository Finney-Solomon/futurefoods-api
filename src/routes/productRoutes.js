// src/routes/productRoutes.js
import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { list, getOne, create, update, remove } from '../controllers/productController.js';

const router = Router();
router.get('/', list);
router.get('/:slug', getOne);
router.post('/', auth, requireRole('admin'), create);
router.put('/:id', auth, requireRole('admin'), update);
router.delete('/:id', auth, requireRole('admin'), remove);
export default router;