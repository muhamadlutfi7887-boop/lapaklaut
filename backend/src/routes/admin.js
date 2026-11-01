import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { auth, role, validate } from '../middleware.js';
import { AppError, h, meta, page } from '../utils.js';
import { cached, cdel } from '../cache.js';
import { buildReport, toPdf, toXlsx } from '../services/report.js';

const r = Router();
r.use(auth, role('admin'));

r.get('/report', cached('report', 30), h(async (req, res) => {
  const ok = await prisma.order.findMany({
    where: { status: 'success' },
    select: { gameId: true, price: true, costPrice: true, discount: true, total: true, createdAt: true },
  });
  const byStatus = await prisma.order.groupBy({ by: ['status'], _count: true });
  const totalOrders = byStatus.reduce((a, s) => a + s._count, 0);
  const daily = [...Array(7)].map((_, i) => {
    const d = new Date(Date.now() - (6 - i) * 864e5);
    return {
      date: d.toISOString().slice(0, 10),
      revenue: ok.filter((o) => o.createdAt.toDateString() === d.toDateString()).reduce((a, o) => a + o.total, 0),
    };
  });
  const sold = {};
  ok.forEach((o) => { sold[o.gameId] = (sold[o.gameId] || 0) + 1; });
  const games = await prisma.game.findMany({ select: { id: true, name: true } });
  res.json({
    revenue: ok.reduce((a, o) => a + o.total, 0),
    profit: ok.reduce((a, o) => a + o.price - o.costPrice - o.discount, 0),
    totalOrders,
    successRate: totalOrders ? Math.round((ok.length / totalOrders) * 100) : 0,
    byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
    daily,
    topGames: games.map((g) => ({ name: g.name, sold: sold[g.id] || 0 })).sort((a, b) => b.sold - a.sold).slice(0, 5),
    lowStock: await prisma.product.findMany({
      where: { active: true, stock: { not: null, lte: 10 } },
      select: { id: true, label: true, stock: true, game: { select: { name: true } } },
    }),
  });
}));

r.get('/report/export', h(async (req, res) => {
  const { format = 'xlsx', from, to } = req.query;
  if (!['xlsx', 'pdf'].includes(format)) throw new AppError(422, 'format harus xlsx atau pdf');
  const d = await buildReport(from, to);
  res.set('Content-Disposition', `attachment; filename="laporan-penjualan-${new Date().toISOString().slice(0, 10)}.${format}"`);
  if (format === 'pdf') { res.set('Content-Type', 'application/pdf'); return toPdf(d, res); }
  res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(Buffer.from(await toXlsx(d)));
}));

r.get('/orders', h(async (req, res) => {
  const p = page(req.query);
  const { status, search, from, to } = req.query;
  const where = {
    ...(status && { status: String(status) }),
    ...(search && { OR: [{ invoice: { contains: String(search) } }, { itemLabel: { contains: String(search) } }, { target: { contains: String(search) } }] }),
    ...((from || to) && { createdAt: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to + 'T23:59:59') }) } }),
  };
  const [total, data] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where, skip: p.skip, take: p.limit, orderBy: { createdAt: 'desc' },
      include: { payment: true, user: { select: { name: true, email: true } } },
    }),
  ]);
  res.json({ data, meta: meta(total, p) });
}));

r.get('/users', h(async (req, res) => {
  const p = page(req.query);
  const [total, data] = await Promise.all([
    prisma.user.count(),
    prisma.user.findMany({ skip: p.skip, take: p.limit, orderBy: { id: 'asc' }, select: { id: true, name: true, email: true, role: true, createdAt: true } }),
  ]);
  res.json({ data, meta: meta(total, p) });
}));


function crud(path, model, schema, { soft = false, include, pre = (x) => x } = {}) {
  const invalidate = () => Promise.all([cdel('games'), cdel('categories'), cdel('report')]);
  r.get('/' + path, h(async (req, res) => {
    const where = soft && req.query.active !== undefined ? { active: req.query.active === 'true' } : undefined;
    res.json(await prisma[model].findMany({ where, orderBy: { id: 'asc' }, include }));
  }));
  r.post('/' + path, validate(schema), h(async (req, res) => {
    const row = await prisma[model].create({ data: pre(req.body) });
    await invalidate();
    res.status(201).json(row);
  }));
  r.put('/' + path + '/:id', validate(schema.partial()), h(async (req, res) => {
    const row = await prisma[model].update({ where: { id: Number(req.params.id) }, data: pre(req.body) });
    await invalidate();
    res.json(row);
  }));
  r.delete('/' + path + '/:id', h(async (req, res) => {
    const where = { id: Number(req.params.id) };
    if (soft) await prisma[model].update({ where, data: { active: false } }); // soft delete: riwayat order tetap utuh
    else await prisma[model].delete({ where });
    await invalidate();
    res.json({ message: soft ? 'Dinonaktifkan' : 'Dihapus' });
  }));
}

const catS = z.object({ name: z.string().trim().min(2).max(40) });
const gameS = z.object({
  name: z.string().trim().min(2).max(60),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/, 'Slug hanya huruf kecil, angka, dan strip'),
  currency: z.string().trim().min(1).max(30),
  categoryId: z.number().int(),
  cover: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#0a6ea8'),
  fields: z.array(z.object({ label: z.string().min(1), pattern: z.string().min(1), hint: z.string().default('') })).min(1).max(3)
    .default([{ label: 'User ID', pattern: '^\\d{6,12}$', hint: '6–12 digit' }]),
  active: z.boolean().default(true),
});
const prodS = z.object({
  gameId: z.number().int(),
  label: z.string().trim().min(1).max(60),
  price: z.number().int().min(1000),
  costPrice: z.number().int().min(0),
  stock: z.number().int().min(0).nullable().default(null),
  active: z.boolean().default(true),
});
const promoS = z.object({
  code: z.string().trim().toUpperCase().min(3).max(20),
  type: z.enum(['percent', 'fixed']),
  value: z.number().int().min(1),
  maxDiscount: z.number().int().nullable().default(null),
  minAmount: z.number().int().min(0).default(0),
  quota: z.number().int().min(0).nullable().default(null),
  active: z.boolean().default(true),
});

crud('categories', 'category', catS);
crud('games', 'game', gameS, {
  soft: true,
  include: { category: true, products: true },
  pre: (d) => ({ ...d, ...(d.fields && { fields: JSON.stringify(d.fields) }) }),
});
crud('products', 'product', prodS, { soft: true });
crud('promos', 'promo', promoS, { soft: true });

export default r;
