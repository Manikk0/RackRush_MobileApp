import { Request, Response, NextFunction } from 'express';
import { PaymentMethodDTO, ErrorResponseDTO } from '../types';
// Route modul pre platobne metody
const router = require('express').Router();
import pool from '../config/db';
import auth from '../middleware/auth';

// Povoleny zoznam typov platby musi sediet s DB enum_payment_type
const ALLOWED_PAYMENT_TYPES = ['card', 'paypal', 'apple_pay', 'google_pay'];

/**
 * @openapi
 * /api/payment-methods:
 *   get:
 *     tags: [Payment Methods]
 *     summary: Get all payment methods for user
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: List of payment methods }
 */
router.get('/', auth, async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM payment_methods WHERE user_id = $1 ORDER BY is_preferred DESC', [req.user.id]);
    res.json(result.rows as PaymentMethodDTO[]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' } as ErrorResponseDTO);
  }
});

/**
 * @openapi
 * /api/payment-methods:
 *   post:
 *     tags: [Payment Methods]
 *     summary: Add a new payment method
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type]
 *             properties:
 *               type: { type: string, enum: [card, paypal, apple_pay, google_pay] }
 *               card_last4: { type: string }
 *               card_brand: { type: string }
 *               is_preferred: { type: boolean }
 *               initial_balance: { type: number, description: "Optional mock balance for project payment simulation" }
 *     responses:
 *       201: { description: Payment method added }
 */
router.post('/', auth, async (req: Request, res: Response) => {
  const { type, card_last4, card_brand, is_preferred, initial_balance } = req.body;
  if (!type) return res.status(400).json({ error: 'type required' } as ErrorResponseDTO);
  if (!ALLOWED_PAYMENT_TYPES.includes(type)) {
    return res.status(400).json({
      error: `Neplatny typ platby. Povolene hodnoty: ${ALLOWED_PAYMENT_TYPES.join(', ')}`,
    } as ErrorResponseDTO);
  }

  try {
    if (is_preferred) {
      await pool.query('UPDATE payment_methods SET is_preferred = FALSE WHERE user_id = $1', [req.user.id]);
    }

    const result = await pool.query(
      `INSERT INTO payment_methods (user_id, type, card_last4, card_brand, is_preferred, mock_balance)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.user.id, type, card_last4 || null, card_brand || null, is_preferred || false, initial_balance ?? 100]
    );
    res.status(201).json(result.rows[0] as PaymentMethodDTO);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' } as ErrorResponseDTO);
  }
});

/**
 * @openapi
 * /api/payment-methods/{id}:
 *   delete:
 *     tags: [Payment Methods]
 *     summary: Remove a payment method
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Payment method removed }
 *       404: { description: Not found }
 */
router.delete('/:id', auth, async (req: Request, res: Response) => {
  try {
    const result = await pool.query('DELETE FROM payment_methods WHERE id = $1 AND user_id = $2 RETURNING id', [req.params.id, req.user.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Payment method not found' } as ErrorResponseDTO);
    res.json({ message: 'Payment method removed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' } as ErrorResponseDTO);
  }
});

/**
 * @openapi
 * /api/payment-methods/{id}/topup:
 *   post:
 *     tags: [Payment Methods]
 *     summary: Top up mock balance on payment method (project simulation)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount: { type: number }
 *     responses:
 *       200: { description: Balance topped up }
 */
router.post('/:id/topup', auth, async (req: Request, res: Response) => {
  const amount = Number(req.body?.amount);
  if (Number.isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: 'amount must be positive number' } as ErrorResponseDTO);
  }

  const result = await pool.query(
    `UPDATE payment_methods
     SET mock_balance = mock_balance + $1
     WHERE id = $2 AND user_id = $3
     RETURNING *`,
    [amount, req.params.id, req.user.id]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'Payment method not found' } as ErrorResponseDTO);
  res.json(result.rows[0] as PaymentMethodDTO);
});

export default router;
