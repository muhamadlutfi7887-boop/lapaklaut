import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../db.js';
import { auth, validate } from '../middleware.js';
import { AppError, h } from '../utils.js';

const r = Router();
const sign = (u) => jwt.sign({ id: u.id, role: u.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
const pub = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role });

const registerS = z.object({
  name: z.string().trim().min(2).max(60),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6).max(72),
});
const loginS = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) });

r.post('/register', validate(registerS), h(async (req, res) => {
  const { name, email, password } = req.body;
  if (await prisma.user.findUnique({ where: { email } })) throw new AppError(409, 'Email sudah terdaftar');
  const u = await prisma.user.create({ data: { name, email, password: await bcrypt.hash(password, 10) } });
  res.status(201).json({ token: sign(u), user: pub(u) });
}));

r.post('/login', validate(loginS), h(async (req, res) => {
  const u = await prisma.user.findUnique({ where: { email: req.body.email } });
  if (!u || !(await bcrypt.compare(req.body.password, u.password))) throw new AppError(401, 'Email atau kata sandi salah');
  res.json({ token: sign(u), user: pub(u) });
}));

r.get('/me', auth, (req, res) => res.json(req.user));

export default r;
