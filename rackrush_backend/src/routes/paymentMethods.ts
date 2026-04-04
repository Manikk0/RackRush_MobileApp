import { Request, Response, NextFunction } from 'express';
import { PaymentMethodDTO, ErrorResponseDTO } from '../types';
// src/routes/paymentMethods.js
const router = require('express').Router();
import pool from '../config/db';
import auth from '../middleware/auth';

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
 *               type: { type: string, enum: [card, paypal, cash, other] }
 *               card_last4: { type: string }
 *               card_brand: { type: string }
 *               is_preferred: { type: boolean }
 *     responses:
 *       201: { description: Payment method added }
 */
router.post('/', auth, async (req: Request, res: Response) => {
  const { type, card_last4, card_brand, is_preferred } = req.body;
  if (!type) return res.status(400).json({ error: 'type required' } as ErrorResponseDTO);

  try {
    if (is_preferred) {
      await pool.query('UPDATE payment_methods SET is_preferred = FALSE WHERE user_id = $1', [req.user.id]);
    }

    const result = await pool.query(
      `INSERT INTO payment_methods (user_id, type, card_last4, card_brand, is_preferred)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.id, type, card_last4 || null, card_brand || null, is_preferred || false]
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

export default router;
