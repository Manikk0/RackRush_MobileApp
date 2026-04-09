import { Request, Response, NextFunction } from 'express';
import { FavoriteDTO, ErrorResponseDTO } from '../types';
// Route modul pre oblubene produkty
const router = require('express').Router();
import pool from '../config/db';
import auth from '../middleware/auth';

/**
 * @openapi
 * /api/favorites:
 *   get:
 *     tags: [Favorites]
 *     summary: Get user's favorite products
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: List of favorite products }
 */
router.get('/', auth, async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT f.*, p.name, p.price, p.image_url, p.category_id
       FROM favorites f
       JOIN products p ON p.id = f.product_id
       WHERE f.user_id = $1`, [req.user.id]
    );
    res.json(result.rows as FavoriteDTO[]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' } as ErrorResponseDTO);
  }
});

/**
 * @openapi
 * /api/favorites:
 *   post:
 *     tags: [Favorites]
 *     summary: Add a product to favorites
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [product_id]
 *             properties:
 *               product_id: { type: integer }
 *     responses:
 *       201: { description: Added to favorites }
 *       200: { description: Already in favorites }
 */
router.post('/', auth, async (req: Request, res: Response) => {
  const { product_id } = req.body;
  if (!product_id) return res.status(400).json({ error: 'product_id required' } as ErrorResponseDTO);
  try {
    const result = await pool.query(
      'INSERT INTO favorites (user_id, product_id) VALUES ($1, $2) ON CONFLICT (user_id, product_id) DO NOTHING RETURNING *',
      [req.user.id, product_id]
    );
    if (!result.rows.length) return res.status(200).json({ message: 'Already in favorites' });
    res.status(201).json(result.rows[0] as FavoriteDTO);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' } as ErrorResponseDTO);
  }
});

/**
 * @openapi
 * /api/favorites/{productId}:
 *   delete:
 *     tags: [Favorites]
 *     summary: Remove product from favorites
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Removed from favorites }
 *       404: { description: Not in favorites }
 */
router.delete('/:productId', auth, async (req: Request, res: Response) => {
  try {
    const result = await pool.query('DELETE FROM favorites WHERE user_id = $1 AND product_id = $2 RETURNING id', [req.user.id, req.params.productId]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not in favorites' } as ErrorResponseDTO);
    res.json({ message: 'Removed from favorites' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' } as ErrorResponseDTO);
  }
});

export default router;
