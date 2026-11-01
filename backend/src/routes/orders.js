import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { auth, validate } from '../middleware.js';
import { AppError, h, meta, page } from '../utils.js';
import { createOrder, settle } from '../services/order.js';

const r = Router();
r.use(auth);

const createS = z.object({
  productId: z.number().int().positive(),
  target: z.array(z.string().max(60)).min(1).max(3),
  method: z.string(),
  promoCode: z.string().trim().max(30).optional(),
});

r.post('/', validate(createS), h(async (req, res) => res.status(201).json(await createOrder(req.user, req.body))));

r.get('/me', h(async (req, res) => {
  const p = page(req.query);
  const where = { userId: req.user.id };
  const [total, data] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({ where, skip: p.skip, take: p.limit, orderBy: { createdAt: 'desc' }, include: { payment: true } }),
  ]);
  res.json({ data, meta: meta(total, p) });
}));

r.get('/:id', h(async (req, res) => {
  const o = await prisma.order.findUnique({ where: { id: Number(req.params.id) }, include: { payment: true } });
  if (!o || (o.userId !== req.user.id && req.user.role !== 'admin')) throw new AppError(404, 'Pesanan tidak ditemukan');
  res.json(o);
}));

r.post('/:id/simulate-pay', h(async (req, res) => {
  const o = await prisma.order.findUnique({ where: { id: Number(req.params.id) }, include: { payment: true } });
  if (!o || o.userId !== req.user.id) throw new AppError(404, 'Pesanan tidak ditemukan');
  res.json(await settle(o.payment.reference));
}));

export default r;
