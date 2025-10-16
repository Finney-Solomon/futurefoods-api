import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import 'dotenv/config';

import { connectDB } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import productRoutes from './routes/productRoutes.js';
import cartRoutes from './routes/cartRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import blogRoutes from './routes/blogRoutes.js';
import recipeRoutes from './routes/recipeRoutes.js';
import errorHandler from './middleware/errorHandler.js';

const app = express();

// CORS: if CORS_ORIGIN is provided, it MUST be valid JSON (e.g., ["*"] or ["http://localhost:5173"]).
const allowedOrigins = process.env.CORS_ORIGIN
  ? JSON.parse(process.env.CORS_ORIGIN)
  : '*';

app.use(helmet());
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false
}));

// Health
app.get('/', (_, res) => res.json({ ok: true, name: 'Future Foods API' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/recipes', recipeRoutes);

// Errors
app.use(errorHandler);

// Ensure DB connection (top-level)
await connectDB();

// Export app for Vercel serverless
export default app;

// Local dev only (Vercel will NOT run this)
if (process.env.NODE_ENV !== 'production') {
  const port = process.env.PORT || 5005;
  app.listen(port, () => console.log(`Local API running on ${port}`));
}



// import express from 'express';
// import morgan from 'morgan';
// import cors from 'cors';
// import helmet from 'helmet';
// import rateLimit from 'express-rate-limit';
// import 'dotenv/config';

// import { connectDB } from './config/db.js';
// import authRoutes from './routes/authRoutes.js';
// import categoryRoutes from './routes/categoryRoutes.js';
// import productRoutes from './routes/productRoutes.js';
// import cartRoutes from './routes/cartRoutes.js';
// import orderRoutes from './routes/orderRoutes.js';
// import blogRoutes from './routes/blogRoutes.js';
// import recipeRoutes from './routes/recipeRoutes.js';
// import errorHandler from './middleware/errorHandler.js';

// const app = express();

// // Security, parsing, logging
// const allowedOrigins = process.env.CORS_ORIGIN
//   ? JSON.parse(process.env.CORS_ORIGIN)
//   : '*';

// app.use(helmet());
// app.use(cors({ origin: allowedOrigins, credentials: true }));
// app.use(express.json({ limit: '1mb' }));
// app.use(morgan('dev'));
// app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 500, standardHeaders: true, legacyHeaders: false }));

// // Health check
// app.get('/', (_, res) => res.json({ ok: true, name: 'Future Foods API' }));

// // Routes
// app.use('/api/auth', authRoutes);
// app.use('/api/categories', categoryRoutes);
// app.use('/api/products', productRoutes);
// app.use('/api/cart', cartRoutes);
// app.use('/api/orders', orderRoutes);
// app.use('/api/blogs', blogRoutes);
// app.use('/api/recipes', recipeRoutes);

// // Errors
// app.use(errorHandler);

// // ⛔️ DO NOT call app.listen on Vercel
// // ✅ Ensure DB connection (with caching inside connectDB)
// await connectDB();

// // ✅ Export the Express app for Vercel
// export default app;
