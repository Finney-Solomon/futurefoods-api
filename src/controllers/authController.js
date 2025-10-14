// src/controllers/authController.js
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { registerSchema, loginSchema } from '../schemas/authSchemas.js';
import { signAccess, signRefresh } from '../utils/tokens.js';
import jwt from 'jsonwebtoken';

export const register = async (req, res, next) => {
  console.log(req,"reqreqreq")
  try {
    const data = registerSchema.parse(req.body);
    const exists = await User.findOne({ email: data.email });
    if (exists) return res.status(409).json({ message: 'Email already registered' });
    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await User.create({ ...data, passwordHash });
    res.status(201).json({ id: user._id });
  } catch (e) { next(e); }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });
    const accessToken = signAccess(user);
    const refreshToken = signRefresh(user);
    res.json({ accessToken, refreshToken, user: { id: user._id, name: user.name, role: user.role } });
  } catch (e) { next(e); }
};

export const refresh = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: 'Missing token' });
    const payload = jwt.verify(token, process.env.REFRESH_SECRET);
    const user = await User.findById(payload.id);
    if (!user) return res.status(401).json({ message: 'Invalid refresh' });
    res.json({ accessToken: signAccess(user) });
  } catch (e) { next(e); }
};