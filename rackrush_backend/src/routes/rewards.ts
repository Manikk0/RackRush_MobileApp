import { Request, Response, NextFunction } from 'express';
import { RewardDTO, RewardCatalogDTO, ErrorResponseDTO } from '../types';
// Route modul pre odmeny a ich aktivaciu
const router = require('express').Router();
import pool from '../config/db';
import auth from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';

/**
 * @openapi
 * /api/rewards/catalog:
 *   get:
 *     tags: [Rewards]
 *     summary: Get rewards catalog (Filtered by user role/age)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: List of available rewards }
 */
router.get('/catalog', auth, async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT * FROM reward_catalog
       WHERE (adults_only = FALSE OR $1 IN ('senior','admin'))
       ORDER BY point_cost`,
      [req.user.role]
    );
    res.json(result.rows as RewardCatalogDTO[]);
  } catch (err) { res.status(500).json({ error: 'Server error' } as ErrorResponseDTO); }
});

/**
 * @openapi
 * /api/rewards/my:
 *   get:
 *     tags: [Rewards]
 *     summary: Get user's acquired rewards and vouchers
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: List of user rewards }
 */
router.get('/my', auth, async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT r.*, rc.title, rc.reward_type, rc.point_cost, rc.description
       FROM rewards r
       JOIN reward_catalog rc ON rc.id = r.catalog_id
       WHERE r.user_id = $1 ORDER BY r.acquired_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Server error' } as ErrorResponseDTO); }
});

/**
 * @openapi
 * /api/rewards/redeem:
 *   post:
 *     tags: [Rewards]
 *     summary: Redeem points for a reward
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [catalog_id]
 *             properties:
 *               catalog_id: { type: integer }
 *     responses:
 *       201: { description: Reward acquired successfully }
 *       400: { description: Insufficient points }
 *       403: { description: Age restriction }
 *       404: { description: Reward not found }
 */
// AI-GENERATED
router.post('/redeem', auth, async (req: Request, res: Response) => {
  const { catalog_id } = req.body;
  if (!catalog_id) return res.status(400).json({ error: 'catalog_id required' } as ErrorResponseDTO);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const catalogItem = await client.query('SELECT * FROM reward_catalog WHERE id = $1', [catalog_id]);
    if (!catalogItem.rows.length) { 
      await client.query('ROLLBACK'); 
      return res.status(404).json({ error: 'Reward not found in catalog' } as ErrorResponseDTO); 
    }

    const item = catalogItem.rows[0];

    // Kontrola vekoveho obmedzenia odmeny podla roly
    if (item.adults_only && !['senior','admin'].includes(req.user.role)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'This reward is for adults only' } as ErrorResponseDTO);
    }

    // Kontrola bodov na vernostnej karte
    const lc = await client.query('SELECT current_points FROM loyalty_cards WHERE user_id = $1', [req.user.id]);
    if (!lc.rows.length || lc.rows[0].current_points < item.point_cost) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient RackPoints' } as ErrorResponseDTO);
    }

    // Odpocitanie bodov
    await client.query('UPDATE loyalty_cards SET current_points = current_points - $1 WHERE user_id = $2', [item.point_cost, req.user.id]);

    // Vytvorenie odmeny s unikatnym kodom
    const uniqueCode = uuidv4();
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + 1); // Platnost 1 mesiac

    const reward = await client.query(
      `INSERT INTO rewards (catalog_id, user_id, unique_code, expires_at) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [catalog_id, req.user.id, uniqueCode, expiryDate]
    );

    await client.query('COMMIT');
    res.status(201).json({ message: 'Reward acquired!', reward: reward.rows[0] as RewardDTO });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' } as ErrorResponseDTO);
  } finally {
    client.release();
  }
});

export default router;
