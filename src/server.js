// src/server.js
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

// NOTE: errorHandler is a DEFAULT export
import errorHandler from './middleware/errorHandler.js';

const app = express();

// --- Security, parsing, logging ---
const allowedOrigins = process.env.CORS_ORIGIN
  ? JSON.parse(process.env.CORS_ORIGIN)
  : "*";

app.use(helmet());

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// --- Health check ---
app.get('/', (_, res) => res.json({ ok: true, name: 'Future Foods API' }));

// --- Routes ---  //
  console.log("reqreqreq")
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/blogs', blogRoutes);

// --- Error handler (must be after routes) ---
app.use(errorHandler);

// --- Start server (ONCE) after DB is ready ---
const port = process.env.PORT || 5005;

const start = async () => {
  try {
    await connectDB(); // ensure DB connected before listening
    app.listen(port, () => console.log(`API listening on ${port}`));
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

start();

// Graceful shutdown for nodemon/ctrl+c
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
