import jwt from 'jsonwebtoken';
import { prisma } from './db.js';
import { AppError } from './utils.js';

export const auth = async (req, res, next) => {
  try {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    if (!token) throw new AppError(401, 'Token tidak ditemukan');
    let payload;
    try { payload = jwt.verify(token, process.env.JWT_SECRET); }
    catch { throw new AppError(401, 'Token tidak valid atau kedaluwarsa'); }
    const user = await prisma.user.findUnique({ where: { id: payload.id }, select: { id: true, name: true, email: true, role: true } });
    if (!user) throw new AppError(401, 'User tidak ditemukan');
    req.user = user;
    next();
  } catch (e) { next(e); }
};

export const role = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : next(new AppError(403, 'Akses ditolak'));

export const validate = (schema, src = 'body') => (req, res, next) => {
  const r = schema.safeParse(req[src]);
  if (!r.success) return next(new AppError(422, 'Validasi gagal', r.error.flatten().fieldErrors));
  req[src] = r.data;
  next();
};

export const notFound = (req, res, next) => next(new AppError(404, 'Endpoint tidak ditemukan'));

export const errorHandler = (err, req, res, next) => {
  if (err.status) return res.status(err.status).json({ message: err.message, errors: err.details });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'JSON tidak valid' });
  if (err.code === 'P2002') return res.status(409).json({ message: 'Data sudah ada (duplikat)' });
  if (err.code === 'P2025') return res.status(404).json({ message: 'Data tidak ditemukan' });
  if (err.code === 'P2003') return res.status(409).json({ message: 'Data masih dipakai data lain' });
  console.error(err);
  res.status(500).json({ message: 'Terjadi kesalahan server' });
};
