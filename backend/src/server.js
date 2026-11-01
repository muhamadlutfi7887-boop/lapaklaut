import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import authR from './routes/auth.js';
import publicR from './routes/public.js';
import ordersR from './routes/orders.js';
import adminR from './routes/admin.js';
import fulfillmentR from './routes/fulfillment.js';
import { errorHandler, notFound } from './middleware.js';
import { expireOrders } from './services/order.js';
import { cacheDriver } from './cache.js';

if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET belum diisi di .env');

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true }));
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 100 }), authR);
app.use('/api/orders', ordersR);
app.use('/api/admin', adminR);
app.use('/api/fulfillment', fulfillmentR);
app.use('/api', publicR);
app.use(notFound);
app.use(errorHandler);

setInterval(() => expireOrders().catch(console.error), 60 * 1000);

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`API jalan di http://localhost:${port}/api (cache: ${cacheDriver}, fulfillment: ${process.env.FULFILLMENT_URL || 'simulasi lokal'})`));
