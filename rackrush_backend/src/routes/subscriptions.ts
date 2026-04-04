import { Request, Response, NextFunction } from 'express';
import { SubscriptionDTO, SubscriptionDetailDTO, ErrorResponseDTO } from '../types';
// src/routes/subscriptions.js
const router = require('express').Router();
import pool from '../config/db';
import auth from '../middleware/auth';

/**
 * @openapi
 * /api/subscriptions/plans:
 *   get:
 *     tags: [Subscriptions]
 *     summary: Get all available subscription plans
 *     responses:
 *       200: { description: List of subscription plans }
 */
router.get('/plans', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM subscription_detail ORDER BY price');
    res.json(result.rows as SubscriptionDetailDTO[]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' } as ErrorResponseDTO);
  }
});

/**
 * @openapi
 * /api/subscriptions/my:
 *   get:
 *     tags: [Subscriptions]
 *     summary: Get active subscription for current user
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Active subscription details }
 */
router.get('/my', auth, async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT s.*, sd.name, sd.features, sd.price
       FROM subscriptions s
       JOIN subscription_detail sd ON sd.id = s.plan_id
       WHERE s.user_id = $1 AND s.is_active = TRUE
       ORDER BY s.expiry_date DESC LIMIT 1`,
      [req.user.id]
    );
    res.json((result.rows[0] || null) as SubscriptionDTO | null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' } as ErrorResponseDTO);
  }
});

/**
 * @openapi
 * /api/subscriptions/buy:
 *   post:
 *     tags: [Subscriptions]
 *     summary: Subscribe to a new plan
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [plan_id]
 *             properties:
 *               plan_id: { type: integer }
 *     responses:
 *       201: { description: Subscription activated }
 *       404: { description: Plan not found }
 */
router.post('/buy', auth, async (req: Request, res: Response) => {
  const { plan_id } = req.body;
  if (!plan_id) return res.status(400).json({ error: 'plan_id required' } as ErrorResponseDTO);

  try {
    const planResult = await pool.query('SELECT * FROM subscription_detail WHERE id = $1', [plan_id]);
    if (!planResult.rows.length) return res.status(404).json({ error: 'Plan not found' } as ErrorResponseDTO);
    const plan = planResult.rows[0];

    // Deactivate previous subscriptions
    await pool.query('UPDATE subscriptions SET is_active = FALSE WHERE user_id = $1', [req.user.id]);

    const startDate = new Date();
    const expiryDate = new Date();
    if (plan.billing_period === 'yearly') { // yearly
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    } else { // monthly
      expiryDate.setMonth(expiryDate.getMonth() + 1);
    }

    const result = await pool.query(
      `INSERT INTO subscriptions (plan_id, user_id, start_date, expiry_date, status, is_active)
       VALUES ($1, $2, $3, $4, 'active', TRUE) RETURNING *`,
      [plan_id, req.user.id, startDate, expiryDate]
    );

    res.status(201).json(result.rows[0] as SubscriptionDTO);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' } as ErrorResponseDTO);
  }
});

export default router;
