import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware.js';
import { AppError, h } from '../utils.js';
import { completeOrder } from '../services/order.js';

const r = Router();

const guard = (req, res, next) =>
  req.headers['x-callback-token'] === process.env.WEBHOOK_TOKEN ? next() : next(new AppError(401, 'Token callback salah'));
const bodyS = z.object({ orderId: z.number().int(), providerRef: z.string().optional(), status: z.enum(['success', 'failed']) });

r.post('/callback', guard, validate(bodyS), h(async (req, res) => {
  const o = await completeOrder(req.body.orderId, req.body.status, req.body.providerRef);
  res.json({ ok: true, status: o.status });
}));

export default r;
