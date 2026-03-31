import { Request, Response, NextFunction } from 'express';
import { AuthResponseDTO, ErrorResponseDTO } from '../types';
// src/routes/auth.js
const router = require('express').Router();
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/db';

const signAccess  = (payload: any) => jwt.sign(payload, process.env.JWT_SECRET as string,         { expiresIn: (process.env.JWT_EXPIRES_IN         || '1h') as any });
const signRefresh = (payload: any) => jwt.sign(payload, process.env.JWT_REFRESH_SECRET as string,  { expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as any });

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags: [Authentication]
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [full_name, email, password]
 *             properties:
 *               full_name: { type: string }
 *               email: { type: string }
 *               password: { type: string }
 *               date_of_birth: { type: string, format: date }
 *     responses:
 *       201: { description: User registered successfully }
 *       400: { description: Missing fields }
 *       409: { description: Email already registered }
 */
router.post('/register', async (req: Request, res: Response) => {
  const { full_name, email, password, date_of_birth } = req.body;
  if (!full_name || !email || !password) {
    return res.status(400).json({ error: 'full_name, email, and password are required' } as ErrorResponseDTO);
  }
  try {
    const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (exists.rows.length) return res.status(409).json({ error: 'Email already registered' } as ErrorResponseDTO);

    const password_hash = await bcrypt.hash(password, 10);

    // Determine role based on age
    let role = 'user';
    if (date_of_birth) {
      const age = Math.floor((new Date().getTime() - new Date(date_of_birth).getTime()) / (365.25 * 24 * 3600 * 1000));
      role = age < 18 ? 'junior' : 'senior';
    }

    const result = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, date_of_birth, role)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, full_name, email, role, created_at`,
      [full_name, email, password_hash, date_of_birth || null, role]
    );
    const user = result.rows[0];

    // Create linked records automatically
    const qrCode = `RACKRUSH-${uuidv4()}`;
    await pool.query(`INSERT INTO loyalty_cards    (user_id, qr_code_data) VALUES ($1, $2)`, [user.id, qrCode]);
    await pool.query(`INSERT INTO user_account     (user_id)               VALUES ($1)`,      [user.id]);
    await pool.query(`INSERT INTO user_preferences (user_id)               VALUES ($1)`,      [user.id]);
    await pool.query(`INSERT INTO user_notifications(user_id)              VALUES ($1)`,      [user.id]);

    const payload = { id: user.id, email: user.email, role: user.role };
    res.status(201).json({
      message: 'User registered successfully',
      user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role },
      access_token:  signAccess(payload),
      refresh_token: signRefresh(payload),
    } as AuthResponseDTO);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' } as ErrorResponseDTO);
  }
});

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Authentication]
 *     summary: Login to account
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       200: { description: Login successful }
 *       401: { description: Invalid credentials }
 */
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' } as ErrorResponseDTO);

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' } as ErrorResponseDTO);

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid)  return res.status(401).json({ error: 'Invalid credentials' } as ErrorResponseDTO);

    const payload = { id: user.id, email: user.email, role: user.role };
    res.json({
      access_token:  signAccess(payload),
      refresh_token: signRefresh(payload),
      user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role },
    } as AuthResponseDTO);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' } as ErrorResponseDTO);
  }
});

// POST /api/auth/refresh
router.post('/refresh', (req: Request, res: Response) => {
  const { refresh_token } = req.body;
  if (!refresh_token) return res.status(400).json({ error: 'refresh_token required' });

  jwt.verify(refresh_token, process.env.JWT_REFRESH_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Invalid refresh token' });
    const payload = { id: decoded.id, email: decoded.email, role: decoded.role };
    res.json({ access_token: signAccess(payload) });
  });
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email required' });
  // In a real app, send an email with a reset link
  res.json({ message: 'If that email exists, a reset link has been sent.' });
});

export default router;
