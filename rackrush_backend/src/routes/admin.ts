import { Request, Response, NextFunction } from 'express';
import { UserDTO, ProductDTO, StoreDTO, OrderDTO, ErrorResponseDTO } from '../types';
// Route modul pre admin funkcie
const router = require('express').Router();
import pool from '../config/db';
import auth from '../middleware/auth';
import role from '../middleware/role';
import { sendPushToUser } from '../services/pushService';

// Vsetky endpointy v tomto subore su iba pre admin rolu
router.use(auth, role('admin'));

/**
 * @openapi
 * /api/admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: List all users in system (Admin only)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: List of users }
 */
router.get('/users', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT id, full_name, email, role, created_at FROM users ORDER BY created_at DESC');
    res.json(result.rows as UserDTO[]);
  } catch (err) { res.status(500).json({ error: 'Server error' } as ErrorResponseDTO); }
});

/**
 * @openapi
 * /api/admin/products:
 *   post:
 *     tags: [Admin]
 *     summary: Create new product (Admin only)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [category_id, name, price]
 *             properties:
 *               category_id: { type: integer }
 *               name: { type: string }
 *               price: { type: number }
 *               description: { type: string }
 *               point_value: { type: integer }
 *               adults_only: { type: boolean }
 *               weight: { type: number }
 *               unit_type: { type: string, enum: [piece, gram, kg, liter, pack] }
 *     responses:
 *       201: { description: Product created }
 */
router.post('/products', async (req: Request, res: Response) => {
  const { category_id, name, price, description, point_value, adults_only, weight, unit_type } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO products (category_id, name, price, description, point_value, adults_only, weight, unit_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [category_id, name, price, description, point_value || 0, adults_only || false, weight, unit_type]
    );
    res.status(201).json(result.rows[0] as ProductDTO);
  } catch (err) { res.status(500).json({ error: 'Server error' } as ErrorResponseDTO); }
});

/**
 * @openapi
 * /api/admin/products/{id}:
 *   put:
 *     tags: [Admin]
 *     summary: Update product (Admin only)
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
 *             properties:
 *               category_id: { type: integer }
 *               name: { type: string }
 *               price: { type: number }
 *               description: { type: string }
 *               point_value: { type: integer }
 *               adults_only: { type: boolean }
 *               weight: { type: number }
 *               unit_type: { type: string, enum: [piece, gram, kg, liter, pack] }
 *     responses:
 *       200: { description: Product updated }
 */
router.put('/products/:id', async (req: Request, res: Response) => {
  const { category_id, name, price, description, point_value, adults_only, weight, unit_type } = req.body;
  try {
    const result = await pool.query(
      `UPDATE products SET
         category_id = COALESCE($1, category_id),
         name        = COALESCE($2, name),
         price       = COALESCE($3, price),
         description = COALESCE($4, description),
         point_value = COALESCE($5, point_value),
         adults_only = COALESCE($6, adults_only),
         weight      = COALESCE($7, weight),
         unit_type   = COALESCE($8, unit_type)
       WHERE id = $9 RETURNING *`,
      [category_id, name, price, description, point_value, adults_only, weight, unit_type, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Product not found' } as ErrorResponseDTO);
    res.json(result.rows[0] as ProductDTO);
  } catch (err) { res.status(500).json({ error: 'Server error' } as ErrorResponseDTO); }
});

/**
 * @openapi
 * /api/admin/stores:
 *   post:
 *     tags: [Admin]
 *     summary: Add a new store (Admin only)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, address, latitude, longitude]
 *             properties:
 *               name: { type: string }
 *               address: { type: string }
 *               latitude: { type: number }
 *               longitude: { type: number }
 *               opening_hours: { type: string }
 *               max_occupancy: { type: integer }
 *     responses:
 *       201: { description: Store created }
 */
router.post('/stores', async (req: Request, res: Response) => {
  const { name, address, latitude, longitude, opening_hours, max_occupancy } = req.body;
  try {
    // V DB je location ulozena ako POINT(longitude, latitude)
    const result = await pool.query(
      'INSERT INTO stores (name, address, location, opening_hours, max_occupancy) VALUES ($1,$2,POINT($3,$4),$5,$6) RETURNING *',
      [name, address, longitude, latitude, opening_hours, max_occupancy || 100]
    );
    res.status(201).json(result.rows[0] as StoreDTO);
  } catch (err) { res.status(500).json({ error: 'Server error' } as ErrorResponseDTO); }
});

/**
 * @openapi
 * /api/admin/orders/{id}/status:
 *   put:
 *     tags: [Admin]
 *     summary: Update order status (Admin only)
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
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [pending, preparing, ready, completed, cancelled] }
 *     responses:
 *       200: { description: Status updated and WS broadcast sent }
 */
router.put('/orders/:id/status', async (req: Request, res: Response) => {
  const { status } = req.body; // Povoleny tok: pending | preparing | ready | completed | cancelled
  try {
    const result = await pool.query('UPDATE orders SET status = $1 WHERE id = $2 RETURNING *', [status, req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Order not found' });
    
    // Poslanie realtime eventu cez WebSocket
    const order = result.rows[0];
    const io = req.app.get('wss');
    if (io) {
      io.broadcast({ type: 'order_status_update', orderId: order.id, status: order.status, userId: order.user_id });
    }

    // Server trigger push notifikacie pri zmene stavu objednavky
    if (order.user_id) {
      await sendPushToUser(Number(order.user_id), {
        title: 'Order status updated',
        body: `Your order #${order.id} is now ${order.status}`,
        deepLink: `rackrush://orders/${order.id}`,
        data: { type: 'order_status_update', orderId: String(order.id), status: String(order.status) },
      });
    }
    
    res.json(order as OrderDTO);
  } catch (err) { res.status(500).json({ error: 'Server error' } as ErrorResponseDTO); }
});

/**
 * @openapi
 * /api/admin/points:
 *   post:
 *     tags: [Admin]
 *     summary: Manually award points (Admin only)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [user_id, points]
 *             properties:
 *               user_id: { type: integer }
 *               points: { type: integer }
 *     responses:
 *       200: { description: Points awarded }
 */
router.post('/points', async (req: Request, res: Response) => {
  const { user_id, points } = req.body;
  try {
    const result = await pool.query('UPDATE loyalty_cards SET current_points = current_points + $1 WHERE user_id = $2 RETURNING current_points', [points, user_id]);
    
    // Poslanie realtime eventu cez WebSocket
    const io = req.app.get('wss');
    if (io) {
      io.broadcast({ type: 'points_updated', userId: user_id, currentPoints: result.rows[0].current_points, added: points });
    }

    // Server trigger push notifikacie pri zmene bodov
    await sendPushToUser(Number(user_id), {
      title: 'RackPoints updated',
      body: `You received ${points} points`,
      deepLink: 'rackrush://loyalty-card',
      data: { type: 'points_updated', added: String(points) },
    });

    res.json({ message: 'Points added', current_points: result.rows[0].current_points });
  } catch (err) { res.status(500).json({ error: 'Server error' } as ErrorResponseDTO); }
});

export default router;
