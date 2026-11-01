import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { prisma } from '../db.js';

const rp = (n) => 'Rp' + Math.round(n).toLocaleString('id-ID');
const tgl = (d) => new Date(d).toISOString().slice(0, 16).replace('T', ' ');

export async function buildReport(from, to) {
  const where = {
    status: 'success',
    ...((from || to) && { createdAt: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to + 'T23:59:59') }) } }),
  };
  const orders = await prisma.order.findMany({ where, orderBy: { createdAt: 'desc' }, include: { game: { select: { name: true } } } });
  return summarize(orders, from, to);
}

export function summarize(orders, from, to) {
  const rows = orders.map((o) => ({
    invoice: o.invoice, date: o.createdAt, game: o.game.name, item: o.itemLabel, target: o.target,
    total: o.total, profit: o.price - o.costPrice - o.discount,
  }));
  const by = {};
  rows.forEach((r) => {
    const g = (by[r.game] = by[r.game] || { name: r.game, qty: 0, revenue: 0, profit: 0 });
    g.qty++; g.revenue += r.total; g.profit += r.profit;
  });
  return {
    from, to, count: rows.length,
    revenue: rows.reduce((a, r) => a + r.total, 0),
    profit: rows.reduce((a, r) => a + r.profit, 0),
    byGame: Object.values(by).sort((a, b) => b.qty - a.qty),
    rows,
  };
}

export async function toXlsx(d) {
  const wb = new ExcelJS.Workbook();
  const s = wb.addWorksheet('Ringkasan');
  s.columns = [{ width: 30 }, { width: 12 }, { width: 18 }, { width: 18 }];
  s.addRow(['Laporan Penjualan LapakLaut']).font = { bold: true, size: 14 };
  s.addRow(['Periode', d.from || 'awal', 's/d', d.to || 'sekarang']);
  s.addRow(['Total transaksi sukses', d.count]);
  s.addRow(['Omzet', d.revenue]);
  s.addRow(['Laba', d.profit]);
  s.addRow([]);
  s.addRow(['Game', 'Terjual', 'Omzet', 'Laba']).font = { bold: true };
  d.byGame.forEach((g) => s.addRow([g.name, g.qty, g.revenue, g.profit]));
  ['C', 'D'].forEach((c) => (s.getColumn(c).numFmt = '#,##0'));
  s.getCell('B4').numFmt = s.getCell('B5').numFmt = '#,##0';

  const t = wb.addWorksheet('Transaksi');
  t.columns = [
    { header: 'Invoice', key: 'invoice', width: 24 }, { header: 'Tanggal', key: 'date', width: 20 }, { header: 'Game', key: 'game', width: 22 },
    { header: 'Item', key: 'item', width: 34 }, { header: 'Akun tujuan', key: 'target', width: 20 },
    { header: 'Total', key: 'total', width: 14, style: { numFmt: '#,##0' } }, { header: 'Laba', key: 'profit', width: 14, style: { numFmt: '#,##0' } },
  ];
  t.getRow(1).font = { bold: true };
  d.rows.forEach((r) => t.addRow({ ...r, date: tgl(r.date) }));
  return wb.xlsx.writeBuffer();
}

export function toPdf(d, stream) {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  doc.pipe(stream);
  doc.fontSize(18).text('Laporan Penjualan LapakLaut');
  doc.moveDown(0.3).fontSize(10).fillColor('#555').text(`Periode: ${d.from || 'awal'} s/d ${d.to || 'sekarang'}`);
  doc.moveDown().fillColor('#000').fontSize(12);
  doc.text(`Transaksi sukses: ${d.count}`).text(`Omzet: ${rp(d.revenue)}`).text(`Laba: ${rp(d.profit)}`);

  const table = (title, cols, rows) => {
    doc.moveDown().fontSize(13).text(title).moveDown(0.4).fontSize(9);
    const line = (cells, bold) => {
      if (doc.y > 770) doc.addPage();
      const y = doc.y;
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica');
      cells.forEach((c, i) => doc.text(String(c), cols[i][1], y, { width: cols[i][2] - 6, lineBreak: false, ellipsis: true }));
      doc.y = y + 14;
    };
    line(cols.map((c) => c[0]), true);
    rows.forEach((r) => line(r, false));
    doc.font('Helvetica');
  };
  table('Penjualan per game', [['Game', 40, 220], ['Terjual', 260, 70], ['Omzet', 330, 110], ['Laba', 440, 110]],
    d.byGame.map((g) => [g.name, g.qty, rp(g.revenue), rp(g.profit)]));
  table(`Transaksi terbaru (maks. 40 dari ${d.count})`, [['Invoice', 40, 130], ['Tanggal', 170, 90], ['Item', 260, 190], ['Total', 450, 100]],
    d.rows.slice(0, 40).map((r) => [r.invoice, tgl(r.date), r.item, rp(r.total)]));
  doc.end();
}
