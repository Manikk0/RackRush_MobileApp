import { Request, Response, NextFunction } from 'express';
import { AuthResponseDTO, ErrorResponseDTO } from '../types';
// Route modul pre autentifikaciu
const router = require('express').Router();
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import pool from '../config/db';
import auth from '../middleware/auth';

// funkcia pre access token
function signAccess(payload: any) {
  const secret = process.env.JWT_SECRET as string;
  const expiresIn = (process.env.JWT_EXPIRES_IN || '1h') as any;
  return jwt.sign(payload, secret, { expiresIn });
}

// funkcia pre refresh token
function signRefresh(payload: any) {
  const secret = process.env.JWT_REFRESH_SECRET as string;
  const expiresIn = (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as any;
  return jwt.sign(payload, secret, { expiresIn });
}

// Pomocna funkcia na hash refresh tokenu
function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Pomocna funkcia na hash reset tokenu
function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Jednoducha expiracia reset tokenu: 30 minut
function getResetExpiryMs(): number {
  return 30 * 60 * 1000;
}

// Poslanie reset emailu (ak nie je smtp nastavene, link zalogujeme)
async function sendResetEmail(email: string, resetLink: string) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.MAIL_FROM || 'no-reply@rackrush.local';

  // Ak nie je smtp nastavene, aspon vypiseme link do logu
  if (!host || !user || !pass) {
    console.warn('SMTP nie je nastavene, reset link iba v logu:', resetLink);
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from,
    to: email,
    subject: 'RackRush - reset hesla',
    text: `Ahoj,\n\nklikni na tento link pre reset hesla:\n${resetLink}\n\nLink je platny 30 minut.\n`,
  });
}

// Ziskanie expiracie refresh tokenu v ms
function getRefreshExpiryMs(): number {
  const raw = (process.env.JWT_REFRESH_EXPIRES_IN || '7d').toString().trim();
  if (raw.endsWith('d')) return parseInt(raw.replace('d', ''), 10) * 24 * 60 * 60 * 1000;
  if (raw.endsWith('h')) return parseInt(raw.replace('h', ''), 10) * 60 * 60 * 1000;
  if (raw.endsWith('m')) return parseInt(raw.replace('m', ''), 10) * 60 * 1000;
  return 7 * 24 * 60 * 60 * 1000;
}

// Vydanie access + refresh tokenu a ulozenie refresh session do DB
async function issueTokens(req: Request, payload: any) {
  const access_token = signAccess(payload);
  const refresh_token = signRefresh(payload);
  const refresh_token_hash = hashRefreshToken(refresh_token);
  const expiresAt = new Date(Date.now() + getRefreshExpiryMs());

  await pool.query(
    `INSERT INTO user_sessions (user_id, refresh_token_hash, user_agent, ip_address, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      payload.id,
      refresh_token_hash,
      (req.headers['user-agent'] || '').toString().substring(0, 255),
      (req.ip || '').toString().substring(0, 100),
      expiresAt,
    ]
  );

  return { access_token, refresh_token };
}

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

    // Rola sa urci podla veku (ak je datum narodenia zadany)
    let role = 'user';
    if (date_of_birth) {
      const age = Math.floor((new Date().getTime() - new Date(date_of_birth).getTime()) / (365.25 * 24 * 3600 * 1000));
      if (age < 18) {
        role = 'junior';
      } else {
        role = 'senior';
      }
    }

    const result = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, date_of_birth, role)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, full_name, email, role, created_at`,
      [full_name, email, password_hash, date_of_birth || null, role]
    );
    const user = result.rows[0];

    // Po registracii vytvorime aj naviazane zaznamy
    const qrCode = `RACKRUSH-${uuidv4()}`;
    await pool.query(`INSERT INTO loyalty_cards    (user_id, qr_code_data) VALUES ($1, $2)`, [user.id, qrCode]);
    await pool.query(`INSERT INTO user_account     (user_id)               VALUES ($1)`,      [user.id]);
    await pool.query(`INSERT INTO user_preferences (user_id)               VALUES ($1)`,      [user.id]);
    await pool.query(`INSERT INTO user_notifications(user_id)              VALUES ($1)`,      [user.id]);

    const payload = { id: user.id, email: user.email, role: user.role };
    const tokens = await issueTokens(req, payload);
    res.status(201).json({
      message: 'User registered successfully',
      user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role },
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
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
    const tokens = await issueTokens(req, payload);
    res.json({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role },
    } as AuthResponseDTO);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' } as ErrorResponseDTO);
  }
});

// Obnova access tokenu cez refresh token (s kontrolou DB session)
router.post('/refresh', async (req: Request, res: Response) => {
  const { refresh_token } = req.body;
  if (!refresh_token) return res.status(400).json({ error: 'refresh_token required' });

  try {
    const decoded = jwt.verify(refresh_token, process.env.JWT_REFRESH_SECRET as string) as any;
    const tokenHash = hashRefreshToken(refresh_token);

    const session = await pool.query(
      `SELECT id, user_id, expires_at, is_revoked
       FROM user_sessions
       WHERE user_id = $1 AND refresh_token_hash = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [decoded.id, tokenHash]
    );
    if (!session.rows.length) return res.status(403).json({ error: 'Invalid refresh token' });
    if (session.rows[0].is_revoked) return res.status(403).json({ error: 'Session revoked' });
    if (new Date(session.rows[0].expires_at).getTime() < Date.now()) {
      return res.status(403).json({ error: 'Refresh token expired' });
    }

    const payload = { id: decoded.id, email: decoded.email, role: decoded.role };
    const tokens = await issueTokens(req, payload);

    // Stary refresh token oznacime ako revokovany (rotacia)
    await pool.query('UPDATE user_sessions SET is_revoked = TRUE WHERE id = $1', [session.rows[0].id]);

    res.json(tokens);
  } catch (err) {
    return res.status(403).json({ error: 'Invalid refresh token' });
  }
});

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     tags: [Authentication]
 *     summary: Logout from current refresh session
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refresh_token]
 *             properties:
 *               refresh_token: { type: string }
 *     responses:
 *       200: { description: Logged out successfully }
 */
router.post('/logout', async (req: Request, res: Response) => {
  const { refresh_token } = req.body;
  if (!refresh_token) return res.status(400).json({ error: 'refresh_token required' });

  const tokenHash = hashRefreshToken(refresh_token);
  await pool.query('UPDATE user_sessions SET is_revoked = TRUE WHERE refresh_token_hash = $1', [tokenHash]);
  res.json({ message: 'Logged out successfully' });
});

/**
 * @openapi
 * /api/auth/logout-all:
 *   post:
 *     tags: [Authentication]
 *     summary: Logout from all sessions
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: All sessions revoked }
 */
router.post('/logout-all', auth, async (req: Request, res: Response) => {
  await pool.query('UPDATE user_sessions SET is_revoked = TRUE WHERE user_id = $1', [req.user.id]);
  res.json({ message: 'All sessions revoked' });
});

/**
 * @openapi
 * /api/auth/sessions:
 *   get:
 *     tags: [Authentication]
 *     summary: List current user's active sessions
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Active sessions }
 */
router.get('/sessions', auth, async (req: Request, res: Response) => {
  const result = await pool.query(
    `SELECT id, user_agent, ip_address, created_at, expires_at
     FROM user_sessions
     WHERE user_id = $1 AND is_revoked = FALSE AND expires_at > NOW()
     ORDER BY created_at DESC`,
    [req.user.id]
  );
  res.json(result.rows);
});

/**
 * @openapi
 * /api/auth/forgot-password:
 *   post:
 *     tags: [Authentication]
 *     summary: Request password reset by email
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string }
 *     responses:
 *       200: { description: Reset link was processed }
 */
router.post('/forgot-password', async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email required' });

  try {
    const userResult = await pool.query('SELECT id, email FROM users WHERE email = $1', [email]);

    // Vzdy vratime rovnaku odpoved (aby sa nedalo zistit ci email existuje)
    if (!userResult.rows.length) {
      return res.json({ message: 'If that email exists, a reset link has been sent.' });
    }

    const user = userResult.rows[0];

    // Zneplatnime stare nepouzite tokeny pre tohto usera
    await pool.query(
      'UPDATE password_reset_tokens SET is_used = TRUE WHERE user_id = $1 AND is_used = FALSE',
      [user.id]
    );

    // Vygenerujeme reset token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashResetToken(rawToken);
    const expiresAt = new Date(Date.now() + getResetExpiryMs());

    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, tokenHash, expiresAt]
    );

    const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
    const resetLink = `${baseUrl}/reset-password?token=${rawToken}`;

    // Pokusime sa poslat email, inak aspon logneme link
    await sendResetEmail(user.email, resetLink);

    return res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @openapi
 * /api/auth/reset-password:
 *   post:
 *     tags: [Authentication]
 *     summary: Reset password with token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, new_password]
 *             properties:
 *               token: { type: string }
 *               new_password: { type: string }
 *     responses:
 *       200: { description: Password reset successful }
 *       400: { description: Missing fields }
 *       403: { description: Invalid or expired token }
 */
router.post('/reset-password', async (req: Request, res: Response) => {
  const { token, new_password } = req.body;
  if (!token || !new_password) {
    return res.status(400).json({ error: 'token and new_password required' });
  }

  try {
    const tokenHash = hashResetToken(token);
    const tokenResult = await pool.query(
      `SELECT id, user_id, expires_at, is_used
       FROM password_reset_tokens
       WHERE token_hash = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [tokenHash]
    );

    if (!tokenResult.rows.length) {
      return res.status(403).json({ error: 'Invalid or expired reset token' });
    }

    const resetRow = tokenResult.rows[0];
    if (resetRow.is_used) {
      return res.status(403).json({ error: 'Invalid or expired reset token' });
    }
    if (new Date(resetRow.expires_at).getTime() < Date.now()) {
      return res.status(403).json({ error: 'Invalid or expired reset token' });
    }

    const passwordHash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, resetRow.user_id]);

    // Pouzity token uz nepovolime znova
    await pool.query('UPDATE password_reset_tokens SET is_used = TRUE WHERE id = $1', [resetRow.id]);

    // Z bezpecnostneho dovodu odhlasime stare sessions
    await pool.query('UPDATE user_sessions SET is_revoked = TRUE WHERE user_id = $1', [resetRow.user_id]);

    return res.json({ message: 'Password reset successful' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
