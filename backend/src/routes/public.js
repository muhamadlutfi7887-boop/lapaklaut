import { Router } from 'express';
import { prisma } from '../db.js';
import { AppError, h, meta, page } from '../utils.js';
import { cached } from '../cache.js';
import { METHODS, calcPromo, settle } from '../services/order.js';

const r = Router();

r.get('/categories', cached('categories', 300), h(async (req, res) => res.json(await prisma.category.findMany({ orderBy: { name: 'asc' } }))));
r.get('/payment-methods', (req, res) => res.json(METHODS));


r.get('/games', cached('games', 60), h(async (req, res) => {
  const p = page(req.query);
  const { search, category } = req.query;
  const where = {
    active: true,
    ...(search && { name: { contains: String(search) } }),
    ...(category && { category: { name: String(category) } }),
  };
  const [total, rows] = await Promise.all([
    prisma.game.count({ where }),
    prisma.game.findMany({
      where, skip: p.skip, take: p.limit, orderBy: { name: 'asc' },
      include: { category: true, products: { where: { active: true }, select: { price: true } } },
    }),
  ]);
  res.json({
    data: rows.map((g) => ({
      id: g.id, slug: g.slug, name: g.name, currency: g.currency, cover: g.cover, category: g.category.name,
      minPrice: g.products.length ? Math.min(...g.products.map((x) => x.price)) : null,
    })),
    meta: meta(total, p),
  });
}));

r.get('/games/:slug', cached('games', 60), h(async (req, res) => {
  const g = await prisma.game.findUnique({
    where: { slug: req.params.slug },
    include: { category: true, products: { where: { active: true }, orderBy: { price: 'asc' } } },
  });
  if (!g || !g.active) throw new AppError(404, 'Game tidak ditemukan');
  res.json({
    ...g, fields: JSON.parse(g.fields), category: g.category.name,
    products: g.products.map(({ costPrice, ...x }) => x), // modal tidak ikut dikirim ke publik
  });
}));

r.get('/promos/check', h(async (req, res) => {
  const code = String(req.query.code || '').toUpperCase();
  const promo = await prisma.promo.findUnique({ where: { code } });
  res.json({ code, discount: calcPromo(promo, Number(req.query.amount) || 0) });
}));


r.post('/payments/webhook', h(async (req, res) => {
  if (req.headers['x-callback-token'] !== process.env.WEBHOOK_TOKEN) throw new AppError(401, 'Token callback salah');
  const { reference, status } = req.body;
  if (status === 'settlement') await settle(reference);
  res.json({ ok: true });
}));

export default r;
