import { Request, Response, NextFunction } from 'express';
import { OrderDTO, OrderItemDTO, ErrorResponseDTO } from '../types';
// src/routes/orders.js
const router = require('express').Router();
import pool from '../config/db';
import auth from '../middleware/auth';

/**
 * @openapi
 * /api/orders:
 *   get:
 *     tags: [Orders]
 *     summary: Get user's order history
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: List of orders }
 */
router.get('/', auth, async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT o.*, s.name AS store_name
       FROM orders o
       LEFT JOIN stores s ON s.id = o.store_id
       WHERE o.user_id = $1
       ORDER BY o.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows as OrderDTO[]);
  } catch (err) { res.status(500).json({ error: 'Server error' } as ErrorResponseDTO); }
});

/**
 * @openapi
 * /api/orders/{id}:
 *   get:
 *     tags: [Orders]
 *     summary: Get order details with items
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Order details }
 *       404: { description: Order not found }
 */
router.get('/:id', auth, async (req: Request, res: Response) => {
  try {
    const order = await pool.query(
      `SELECT o.*, s.name AS store_name
       FROM orders o LEFT JOIN stores s ON s.id = o.store_id
       WHERE o.id = $1 AND o.user_id = $2`, [req.params.id, req.user.id]
    );
    if (!order.rows.length) return res.status(404).json({ error: 'Order not found' } as ErrorResponseDTO);

    const items = await pool.query(
      `SELECT oi.*, p.name AS product_name, p.image_url
       FROM order_items oi
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = $1`, [req.params.id]
    );
    res.json({ ...order.rows[0], items: items.rows });
  } catch (err) { res.status(500).json({ error: 'Server error' } as ErrorResponseDTO); }
});

/**
 * @openapi
 * /api/orders:
 *   post:
 *     tags: [Orders]
 *     summary: Create new order and earn loyalty points
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [items]
 *             properties:
 *               store_id: { type: integer }
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [product_id, quantity]
 *                   properties:
 *                     product_id: { type: integer }
 *                     quantity: { type: integer }
 *               in_store_purchase: { type: boolean }
 *               point_cost: { type: integer, description: Points to use as discount }
 *               offer_id: { type: integer, description: User Activated Offer ID }
 *               payment_method: { type: string, enum: [cash, card, other] }
 *     responses:
 *       201: { description: Order created successfully }
 *       400: { description: Insufficient points or unavailable products }
 */
router.post('/', auth, async (req: Request, res: Response) => {
  const { store_id, items, in_store_purchase, point_cost, offer_id, payment_method } = req.body;
  // items = [{ product_id, quantity }]
  if (!items || !items.length) return res.status(400).json({ error: 'items[] required' } as ErrorResponseDTO);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Calculate totals
    let total = 0;
    const enriched = [];
    for (const item of items) {
      const p = await client.query('SELECT price, point_value FROM products WHERE id = $1 AND is_available = TRUE', [item.product_id]);
      if (!p.rows.length) { 
        await client.query('ROLLBACK'); 
        return res.status(400).json({ error: `Product ${item.product_id} not found or unavailable` } as ErrorResponseDTO); 
      }
      const price = parseFloat(p.rows[0].price);
      total      += price * item.quantity;
      enriched.push({ ...item, price_at_purchase: price, point_value: p.rows[0].point_value });
    }

    // Deduct points if used
    const pointsUsed = point_cost || 0;
    if (pointsUsed > 0) {
      const lc = await client.query('SELECT current_points FROM loyalty_cards WHERE user_id = $1', [req.user.id]);
      if (!lc.rows.length || lc.rows[0].current_points < pointsUsed) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Not enough RackPoints' } as ErrorResponseDTO);
      }
      await client.query('UPDATE loyalty_cards SET current_points = current_points - $1 WHERE user_id = $2', [pointsUsed, req.user.id]);
      total = Math.max(0, total - pointsUsed * 0.01); // 1 point = 0.01 €
    }

    // Create order
    const order = await client.query(
      `INSERT INTO orders (user_id, store_id, total_price, in_store_purchase, status, payment_method)
       VALUES ($1,$2,$3,$4,'pending',$5) RETURNING *`,
      [req.user.id, store_id || null, total.toFixed(2), in_store_purchase || false, payment_method || 'other']
    );
    const orderId = order.rows[0].id;

    // Insert items
    for (const item of enriched) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase)
         VALUES ($1,$2,$3,$4)`,
        [orderId, item.product_id, item.quantity, item.price_at_purchase]
      );
    }

    // Earn points (1 per euro)
    const pointsEarned = Math.floor(total);
    await client.query('UPDATE loyalty_cards SET current_points = current_points + $1 WHERE user_id = $2', [pointsEarned, req.user.id]);

    // Mark offer as used if provided - Linked through reward_id
    if (offer_id) {
      // Check if offer belongs to user
      const checkOffer = await client.query(
        `SELECT uao.id FROM user_activated_offers uao 
         JOIN rewards r ON r.id = uao.reward_id 
         WHERE uao.id = $1 AND r.user_id = $2`, [offer_id, req.user.id]
      );
      if (checkOffer.rows.length) {
        await client.query(
          `UPDATE user_activated_offers SET status='used', order_id=$1 WHERE id=$2`,
          [orderId, offer_id]
        );
      }
    }

    // Create receipt
    await client.query(
      `INSERT INTO receipts (order_id, user_id, raw_content) VALUES ($1,$2,$3)`,
      [orderId, req.user.id, JSON.stringify({ order: order.rows[0], items: enriched })]
    );

    await client.query('COMMIT');

    // Notify via WebSocket
    const io = req.app.get('wss');
    if (io) {
      io.broadcast({ type: 'order_created', orderId, userId: req.user.id, pointsEarned });
    }

    res.status(201).json({ ...(order.rows[0] as OrderDTO), points_earned: pointsEarned });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' } as ErrorResponseDTO);
  } finally {
    client.release();
  }
});

export default router;
