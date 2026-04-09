import { Request, Response, NextFunction } from 'express';
import { SubscriptionDTO, SubscriptionDetailDTO, ErrorResponseDTO } from '../types';
// Route modul pre predplatne
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
 *               payment_method_id: { type: integer, description: "Optional, if missing backend uses preferred method" }
 *     responses:
 *       201: { description: Subscription activated }
 *       400: { description: Insufficient payment balance or no payment method }
 *       404: { description: Plan not found }
 */
router.post('/buy', auth, async (req: Request, res: Response) => {
  const { plan_id, payment_method_id } = req.body;
  if (!plan_id) return res.status(400).json({ error: 'plan_id required' } as ErrorResponseDTO);

  try {
    const planResult = await pool.query('SELECT * FROM subscription_detail WHERE id = $1', [plan_id]);
    if (!planResult.rows.length) return res.status(404).json({ error: 'Plan not found' } as ErrorResponseDTO);
    const plan = planResult.rows[0];

    // Vyber payment metody: konkretna id alebo preferovana
    const pmResult = payment_method_id
      ? await pool.query(
          `SELECT * FROM payment_methods
           WHERE id = $1 AND user_id = $2 AND is_active = TRUE`,
          [payment_method_id, req.user.id]
        )
      : await pool.query(
          `SELECT * FROM payment_methods
           WHERE user_id = $1 AND is_active = TRUE
           ORDER BY is_preferred DESC, id DESC
           LIMIT 1`,
          [req.user.id]
        );
    if (!pmResult.rows.length) {
      return res.status(400).json({ error: 'No active payment method' } as ErrorResponseDTO);
    }
    const paymentMethod = pmResult.rows[0];

    // Jednoducha simulacia platby pre projekt:
    // ak je zostatok mensi ako cena planu, zakupenie zlyha
    const planPrice = Number(plan.price);
    const balance = Number(paymentMethod.mock_balance || 0);
    if (balance < planPrice) {
      return res.status(400).json({ error: 'Insufficient funds on selected payment method' } as ErrorResponseDTO);
    }

    // Pred aktivaciou noveho planu vypneme stare aktivne predplatne
    await pool.query('UPDATE subscriptions SET is_active = FALSE WHERE user_id = $1', [req.user.id]);

    const startDate = new Date();
    const expiryDate = new Date();
    if (plan.billing_period === 'yearly') { // Rocne predplatne
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    } else { // Mesacne predplatne
      expiryDate.setMonth(expiryDate.getMonth() + 1);
    }

    const result = await pool.query(
      `INSERT INTO subscriptions (plan_id, user_id, payment_card_token, start_date, expiry_date, status, is_active)
       VALUES ($1, $2, $3, $4, $5, 'active', TRUE) RETURNING *`,
      [plan_id, req.user.id, `pm:${paymentMethod.id}`, startDate, expiryDate]
    );

    // Odpocitanie zostatku po uspesnej "platbe"
    await pool.query(
      'UPDATE payment_methods SET mock_balance = mock_balance - $1 WHERE id = $2',
      [planPrice, paymentMethod.id]
    );

    res.status(201).json(result.rows[0] as SubscriptionDTO);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' } as ErrorResponseDTO);
  }
});

export default router;
