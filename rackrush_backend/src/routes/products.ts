import { Request, Response, NextFunction } from 'express';
import { ProductDTO, ErrorResponseDTO } from '../types';
// Route modul pre produkty
const router = require('express').Router();
import pool from '../config/db';
import auth from '../middleware/auth';
import jwt from 'jsonwebtoken';

// zoznam produktov: junior nikdy nevidi adults_only; senior/admin vidi ak query adults_only=true

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
// AI-ASSISTED
router.get('/', auth, async (req: Request, res: Response) => {
  const { category_id, search, adults_only } = req.query;
  const userRole = req.user.role; // Ockavana rola: junior | senior | admin

  let query  = `SELECT p.*, c.name AS category_name
                FROM products p
                LEFT JOIN categories c ON c.id = p.category_id
                WHERE 1=1`;
  const vals: any[] = [];
  let   i    = 1;

  if (category_id) { query += ` AND p.category_id = $${i++}`; vals.push(category_id); }
  if (search)      { query += ` AND LOWER(p.name) LIKE $${i++}`; vals.push(`%${(search as string).toLowerCase()}%`); }

  // user bez datum narodenia: pri zozname sa sprava ako senior (adults_only len ak explicitne v query); objednavku adults_only aj tak blokuje orders
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
// AI-REFINED
router.get('/:id', async (req: Request, res: Response) => {
  try {
    // Ak je user prihlaseny a je junior, nech nedostane adults_only produkt
    let role: string | null = null;
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;
        role = decoded?.role || null;
      } catch (e) {
        // Ak je token neplatny, endpoint stale moze fungovat ako "public detail"
        role = null;
      }
    }

    const result = await pool.query(
      `SELECT p.*, c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.id = $1`, [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Product not found' } as ErrorResponseDTO);

    if (role === 'junior' && result.rows[0].adults_only === true) {
      return res.status(403).json({ error: 'Tento produkt je dostupny iba pre dospelych' } as ErrorResponseDTO);
    }

    res.json(result.rows[0] as ProductDTO);
  } catch (err) { res.status(500).json({ error: 'Server error' } as ErrorResponseDTO); }
});

export default router;
