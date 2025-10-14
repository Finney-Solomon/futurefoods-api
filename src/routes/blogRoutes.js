// src/routes/blogRoutes.js
import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import {
  listBlogs,
  getFeatured,
  getBySlug,
  createBlog,
  updateBlog,
  softDeleteBlog,
  restoreBlog,
} from '../controllers/blogController.js';

const router = Router();

// Public reads
router.get('/', listBlogs);
router.get('/featured', getFeatured);
router.get('/:slug', getBySlug);

// Admin writes
router.post('/', auth, createBlog);
router.put('/:id', auth, updateBlog);

// DELETE -> soft delete (inactive)
router.delete('/:id', auth, softDeleteBlog);

// Optional restore endpoint
router.post('/:id/restore', auth, restoreBlog);

export default router;
