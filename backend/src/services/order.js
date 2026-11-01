import { prisma } from '../db.js';
import { AppError, ymd } from '../utils.js';
import { cdel } from '../cache.js';

export const METHODS = [
  { code: 'QRIS', name: 'QRIS', fee: 0 },
  { code: 'GOPAY', name: 'GoPay', fee: 1000 },
  { code: 'DANA', name: 'DANA', fee: 1000 },
  { code: 'BCA_VA', name: 'BCA Virtual Account', fee: 2500 },
  { code: 'MINIMARKET', name: 'Minimarket', fee: 3500 },
];

export function calcPromo(p, amount) {
  if (!p || !p.active) throw new AppError(404, 'Kode promo tidak valid');
  if (p.quota !== null && p.quota < 1) throw new AppError(409, 'Kuota promo sudah habis');
  if (amount < p.minAmount) throw new AppError(422, `Minimal pembelian Rp${p.minAmount.toLocaleString('id-ID')}`);
  let d = p.type === 'percent' ? Math.floor((amount * p.value) / 100) : p.value;
  if (p.maxDiscount) d = Math.min(d, p.maxDiscount);
  return Math.min(d, amount);
}

export function checkTarget(game, target) {
  const rules = JSON.parse(game.fields);
  if (!Array.isArray(target) || target.length !== rules.length) throw new AppError(422, 'Data akun tidak lengkap');
  const errors = {};
  rules.forEach((r, i) => {
    if (!new RegExp(r.pattern).test(String(target[i]).trim())) errors[r.label] = [`${r.label} tidak valid (${r.hint})`];
  });
  if (Object.keys(errors).length) throw new AppError(422, 'Data akun tidak valid', errors);
  return target.map((t) => String(t).trim()).join(' / ');
}

async function release(tx, o) {
  const p = await tx.product.findUnique({ where: { id: o.productId } });
  if (p && p.stock !== null) await tx.product.update({ where: { id: p.id }, data: { stock: { increment: 1 } } });
  if (o.promoId) {
    const q = await tx.promo.findUnique({ where: { id: o.promoId } });
    if (q && q.quota !== null) await tx.promo.update({ where: { id: q.id }, data: { quota: { increment: 1 } } });
  }
}

export async function createOrder(user, b) {
  const product = await prisma.product.findUnique({ where: { id: b.productId }, include: { game: true } });
  if (!product || !product.active || !product.game.active) throw new AppError(404, 'Produk tidak tersedia');
  const method = METHODS.find((m) => m.code === b.method);
  if (!method) throw new AppError(422, 'Metode pembayaran tidak valid');
  const target = checkTarget(product.game, b.target);

  let promo = null, discount = 0;
  if (b.promoCode) {
    promo = await prisma.promo.findUnique({ where: { code: b.promoCode.toUpperCase() } });
    discount = calcPromo(promo, product.price);
  }
  const total = product.price + method.fee - discount;

  const order = await prisma.$transaction(async (tx) => {
    if (product.stock !== null) {
      const r = await tx.product.updateMany({ where: { id: product.id, stock: { gte: 1 } }, data: { stock: { decrement: 1 } } });
      if (!r.count) throw new AppError(409, 'Stok produk habis');
    }
    if (promo && promo.quota !== null) {
      const r = await tx.promo.updateMany({ where: { id: promo.id, quota: { gte: 1 } }, data: { quota: { decrement: 1 } } });
      if (!r.count) throw new AppError(409, 'Kuota promo sudah habis');
    }
    const invoice = `INV-${ymd(new Date())}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    return tx.order.create({
      data: {
        invoice, userId: user.id, gameId: product.gameId, productId: product.id,
        itemLabel: `${product.game.name} · ${product.label}`, target,
        price: product.price, costPrice: product.costPrice, fee: method.fee, discount, total,
        promoId: promo ? promo.id : undefined,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        payment: { create: { method: method.code, reference: 'PAY-' + invoice.slice(4) } },
      },
      include: { payment: true },
    });
  });
  await invalidate(); 
  return order;
}

export async function settle(reference) {
  const pay = await prisma.payment.findUnique({ where: { reference }, include: { order: true } });
  if (!pay) throw new AppError(404, 'Pembayaran tidak ditemukan');
  if (pay.status === 'paid') return pay.order;
  if (pay.order.status !== 'pending') throw new AppError(409, `Pesanan sudah ${pay.order.status}`);
  if (pay.order.expiresAt < new Date()) throw new AppError(409, 'Pesanan sudah kedaluwarsa');
  const r = await prisma.order.updateMany({ where: { id: pay.orderId, status: 'pending' }, data: { status: 'paid' } });
  if (!r.count) return pay.order;
  await prisma.payment.update({ where: { id: pay.id }, data: { status: 'paid', paidAt: new Date() } });
  fulfill(pay.orderId);
  return prisma.order.findUnique({ where: { id: pay.orderId }, include: { payment: true } });
}

const invalidate = () => Promise.all([cdel('games'), cdel('report')]);

export async function completeOrder(id, status, providerRef) {
  const o = await prisma.order.findUnique({ where: { id } });
  if (!o) throw new AppError(404, 'Pesanan tidak ditemukan');
  if (['success', 'failed'].includes(o.status)) return o;
  if (!['paid', 'processing'].includes(o.status)) throw new AppError(409, `Pesanan berstatus ${o.status}`);
  const live = { id, status: { in: ['paid', 'processing'] } };
  if (status === 'success') {
    await prisma.order.updateMany({ where: live, data: { status: 'success', ...(providerRef && { providerRef }) } });
  } else {
    await prisma.$transaction(async (tx) => {
      const r = await tx.order.updateMany({ where: live, data: { status: 'failed', ...(providerRef && { providerRef }) } });
      if (r.count) await release(tx, o); 
    });
  }
  await invalidate();
  return prisma.order.findUnique({ where: { id } });
}

const safe = (fn) => async () => { try { await fn(); } catch (e) { console.error('[fulfill]', e.message); } };

export function fulfill(id) {
  if (process.env.FULFILLMENT_URL) { dispatch(id); return; }
  setTimeout(safe(async () => {
    await prisma.order.update({ where: { id }, data: { status: 'processing' } });
    setTimeout(safe(async () => {
      const o = await prisma.order.findUnique({ where: { id } });
      await completeOrder(id, o.target.trim().endsWith('000') ? 'failed' : 'success');
    }), 1500);
  }), 800);
}

async function dispatch(id) {
  try {
    const o = await prisma.order.findUnique({ where: { id }, include: { game: true } });
    await prisma.order.update({ where: { id }, data: { status: 'processing' } });
    const r = await fetch(process.env.FULFILLMENT_URL + '/topup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-service-key': process.env.SERVICE_KEY || '' },
      body: JSON.stringify({ orderId: id, invoice: o.invoice, game: o.game.name, item: o.itemLabel, target: o.target }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new Error('Fulfillment service membalas ' + r.status);
    const j = await r.json();
    await prisma.order.update({ where: { id }, data: { providerRef: j.providerRef } });
  } catch (e) {
    console.error('[fulfill]', e.message);
    await completeOrder(id, 'failed').catch(console.error); 
  }
}

export async function expireOrders() {
  const list = await prisma.order.findMany({ where: { status: 'pending', expiresAt: { lt: new Date() } } });
  for (const o of list) {
    await prisma.$transaction(async (tx) => {
      const r = await tx.order.updateMany({ where: { id: o.id, status: 'pending' }, data: { status: 'expired' } });
      if (!r.count) return;
      await tx.payment.updateMany({ where: { orderId: o.id }, data: { status: 'expired' } });
      await release(tx, o);
    });
  }
  if (list.length) await invalidate();
}
