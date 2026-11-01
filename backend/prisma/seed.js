import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { ymd } from '../src/utils.js';

const prisma = new PrismaClient();
const F = (label, pattern, hint) => ({ label, pattern, hint });
const games = [
  ['mobile-legends', 'Mobile Legends', 'Diamond', 'MOBA', '#1e3a8a', [F('User ID', '^\\d{6,12}$', '6–12 digit'), F('Zone ID', '^\\d{3,5}$', '3–5 digit')], [[86, 20000], [172, 39000], [257, 58000], [344, 77000], [514, 115000], [706, 155000]]],
  ['free-fire', 'Free Fire', 'Diamond', 'Battle Royale', '#9a3412', [F('Player ID', '^\\d{8,12}$', '8–12 digit')], [[50, 7000], [140, 19000], [355, 48000], [720, 95000]]],
  ['pubg-mobile', 'PUBG Mobile', 'UC', 'Battle Royale', '#365314', [F('Character ID', '^\\d{8,12}$', '8–12 digit')], [[60, 15000], [325, 75000], [660, 149000], [1800, 379000]]],
  ['genshin-impact', 'Genshin Impact', 'Genesis Crystal', 'RPG', '#5b21b6', [F('UID', '^\\d{9}$', '9 digit')], [[60, 16000], [330, 79000], [1090, 249000]]],
  ['valorant', 'Valorant', 'VP', 'FPS', '#9f1239', [F('Riot ID', '^.{3,16}#\\w{3,5}$', 'contoh Nama#1234')], [[475, 50000], [1000, 100000], [2050, 200000]]],
  ['call-of-duty-mobile', 'Call of Duty Mobile', 'CP', 'FPS', '#1f2937', [F('Open ID', '^\\d{10,20}$', '10–20 digit')], [[80, 15000], [420, 75000], [880, 150000]]],
  ['honor-of-kings', 'Honor of Kings', 'Token', 'MOBA', '#0e7490', [F('User ID', '^\\d{8,12}$', '8–12 digit')], [[80, 15000], [240, 45000], [400, 75000]]],
  ['roblox', 'Roblox', 'Robux', 'Voucher', '#b91c1c', [F('Username', '^\\w{3,20}$', '3–20 karakter')], [[80, 15000], [400, 75000], [800, 150000], [1700, 300000]], 100],
];

async function main() {
  for (const m of ['payment', 'order', 'product', 'game', 'category', 'promo', 'user']) await prisma[m].deleteMany();
  const pw = await bcrypt.hash('123456', 10);
  await prisma.user.create({ data: { name: 'Admin', email: 'admin@lapaklaut.id', password: pw, role: 'admin' } });
  const user = await prisma.user.create({ data: { name: 'Budi', email: 'user@lapaklaut.id', password: pw } });

  const cats = {};
  for (const n of new Set(games.map((g) => g[3]))) cats[n] = await prisma.category.create({ data: { name: n } });

  const created = [];
  for (const [slug, name, cur, cat, cover, fields, prods, stock] of games) {
    created.push(await prisma.game.create({
      data: {
        slug, name, currency: cur, cover, categoryId: cats[cat].id, fields: JSON.stringify(fields),
        products: { create: prods.map(([a, p]) => ({ label: `${a} ${cur}`, price: p, costPrice: Math.round(p * 0.94), stock: stock ?? null })) },
      },
      include: { products: true },
    }));
  }

  await prisma.promo.createMany({
    data: [
      { code: 'LAUT10', type: 'percent', value: 10, maxDiscount: 10000 },
      { code: 'HEMAT5K', type: 'fixed', value: 5000, minAmount: 50000 },
      { code: 'NEWUSER', type: 'percent', value: 15, maxDiscount: 15000, quota: 100 },
    ],
  });

  for (let i = 0; i < 40; i++) {
    const g = created[i % created.length], p = g.products[i % g.products.length];
    const d = new Date(Date.now() - (i % 14) * 864e5 - i * 36e5);
    const st = i % 9 === 4 ? 'failed' : i % 7 === 3 ? 'expired' : 'success';
    const invoice = `INV-${ymd(d)}-${1000 + i}`;
    await prisma.order.create({
      data: {
        invoice, userId: user.id, gameId: g.id, productId: p.id, itemLabel: `${g.name} · ${p.label}`,
        target: String(100000000 + i * 7919), price: p.price, costPrice: p.costPrice, fee: 0, discount: 0, total: p.price,
        status: st, createdAt: d, expiresAt: new Date(+d + 15 * 60000),
        payment: { create: { method: 'QRIS', reference: 'PAY-' + invoice.slice(4), status: st === 'expired' ? 'expired' : 'paid', paidAt: st === 'expired' ? null : d } },
      },
    });
  }
  console.log('Seed selesai. Admin: admin@lapaklaut.id / 123456 · User: user@lapaklaut.id / 123456');
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
