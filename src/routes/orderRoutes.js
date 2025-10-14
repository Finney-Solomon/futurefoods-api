// src/routes/orderRoutes.js
import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { createOrderFromCart, listOrders ,myOrders} from '../controllers/orderController.js';

const router = Router();
router.post('/', auth, createOrderFromCart);
router.get('/', auth, requireRole('admin'), listOrders);
router.get('/myOrders', auth, myOrders);
export default router;