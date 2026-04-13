import { Request, Response, NextFunction } from 'express';
import { ReceiptDTO, ErrorResponseDTO } from '../types';
// Route modul pre pokladnicne bloky
const router = require('express').Router();
import pool from '../config/db';
import auth from '../middleware/auth';

/**
 * @openapi
 * /api/receipts:
 *   get:
 *     tags: [Receipts]
 *     summary: Get list of all receipts for current user
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: List of receipts }
 */
// pokladnicne bloky usera s joinom na objednavku a predajnu
router.get('/', auth, async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT r.*, o.total_price, o.status, o.created_at AS order_date, s.name AS store_name
       FROM receipts r
       JOIN orders o ON o.id = r.order_id
       LEFT JOIN stores s ON s.id = o.store_id
       WHERE r.user_id = $1
       ORDER BY r.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows as ReceiptDTO[]);
  } catch (err) { res.status(500).json({ error: 'Server error' } as ErrorResponseDTO); }
});

/**
 * @openapi
 * /api/receipts/{id}:
 *   get:
 *     tags: [Receipts]
 *     summary: Get specific receipt detail
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Receipt details }
 *       404: { description: Receipt not found }
 */
// jeden blok + suma a stav objednavky
router.get('/:id', auth, async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT r.*, o.total_price, o.status, s.name AS store_name
       FROM receipts r
       JOIN orders o ON o.id = r.order_id
       LEFT JOIN stores s ON s.id = o.store_id
       WHERE r.id = $1 AND r.user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Receipt not found' } as ErrorResponseDTO);
    res.json(result.rows[0] as ReceiptDTO);
  } catch (err) { res.status(500).json({ error: 'Server error' } as ErrorResponseDTO); }
});

export default router;
