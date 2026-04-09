import { Request, Response, NextFunction } from 'express';
import { LoyaltyCardDTO, ErrorResponseDTO } from '../types';
// Route modul pre vernostnu kartu
const router = require('express').Router();
import pool from '../config/db';
import auth from '../middleware/auth';

/**
 * @openapi
 * /api/loyalty-card:
 *   get:
 *     tags: [Loyalty Card]
 *     summary: Get user's loyalty card details
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Loyalty card data }
 */
router.get('/', auth, async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT lc.*, u.full_name, u.email
       FROM loyalty_cards lc
       JOIN users u ON u.id = lc.user_id
       WHERE lc.user_id = $1`, [req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Loyalty card not found' } as ErrorResponseDTO);
    res.json(result.rows[0] as LoyaltyCardDTO);
  } catch (err) { res.status(500).json({ error: 'Server error' } as ErrorResponseDTO); }
});

/**
 * @openapi
 * /api/loyalty-card/qr:
 *   get:
 *     tags: [Loyalty Card]
 *     summary: Get QR code data for offline use
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: QR content }
 */
router.get('/qr', auth, async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT qr_code_data, current_points FROM loyalty_cards WHERE user_id = $1', [req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Loyalty card not found' } as ErrorResponseDTO);
    res.json(result.rows[0] as Partial<LoyaltyCardDTO>);
  } catch (err) { res.status(500).json({ error: 'Server error' } as ErrorResponseDTO); }
});

/**
 * @openapi
 * /api/loyalty-card/points/add:
 *   post:
 *     tags: [Loyalty Card]
 *     summary: Add points manually
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [points]
 *             properties:
 *               points: { type: integer }
 *     responses:
 *       200: { description: Points added }
 */
router.post('/points/add', auth, async (req: Request, res: Response) => {
  const { points } = req.body;
  if (!points || points <= 0) return res.status(400).json({ error: 'points must be > 0' } as ErrorResponseDTO);
  try {
    const result = await pool.query(
      'UPDATE loyalty_cards SET current_points = current_points + $1 WHERE user_id = $2 RETURNING current_points',
      [points, req.user.id]
    );
    res.json({ current_points: result.rows[0].current_points, added: points });
  } catch (err) { res.status(500).json({ error: 'Server error' } as ErrorResponseDTO); }
});

export default router;
