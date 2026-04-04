import { Request, Response, NextFunction } from 'express';
import { ProductDTO, ErrorResponseDTO } from '../types';
// src/routes/products.js
const router = require('express').Router();
import pool from '../config/db';
import auth from '../middleware/auth';

/**
 * @openapi
 * /api/products:
 *   get:
 *     tags: [Products]
 *     summary: Get list of products with filters
 *     parameters:
 *       - in: query
 *         name: category_id
 *         schema: { type: integer }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: adults_only
 *         schema: { type: boolean }
 *     responses:
 *       200: { description: List of products }
 */
router.get('/', auth, async (req: Request, res: Response) => {
  const { category_id, search, adults_only } = req.query;
  const userRole = req.user.role; // 'junior', 'senior', or 'admin'

  let query  = `SELECT p.*, c.name AS category_name
                FROM products p
                LEFT JOIN categories c ON c.id = p.category_id
                WHERE 1=1`;
  const vals: any[] = [];
  let   i    = 1;

  if (category_id) { query += ` AND p.category_id = $${i++}`; vals.push(category_id); }
  if (search)      { query += ` AND LOWER(p.name) LIKE $${i++}`; vals.push(`%${(search as string).toLowerCase()}%`); }
  
  // ROLE-BASED FILTERING
  // Senior/Admin can see adult content if requested. Junior is always blocked.
  if (userRole === 'junior' || (!adults_only || adults_only === 'false')) {
    query += ` AND p.adults_only = FALSE`;
  }

  query += ' ORDER BY p.name';
  try {
    const result = await pool.query(query, vals);
    res.json(result.rows as ProductDTO[]);
  } catch (err) { res.status(500).json({ error: 'Server error' } as ErrorResponseDTO); }
});

/**
 * @openapi
 * /api/products/{id}:
 *   get:
 *     tags: [Products]
 *     summary: Get product details
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Product details }
 *       404: { description: Product not found }
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT p.*, c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.id = $1`, [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Product not found' } as ErrorResponseDTO);
    res.json(result.rows[0] as ProductDTO);
  } catch (err) { res.status(500).json({ error: 'Server error' } as ErrorResponseDTO); }
});

export default router;
