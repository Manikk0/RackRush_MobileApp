import { Request, Response, NextFunction } from 'express';
import { CategoryDTO, ErrorResponseDTO } from '../types';
// src/routes/categories.js
const router = require('express').Router();
import pool from '../config/db';

/**
 * @openapi
 * /api/categories:
 *   get:
 *     tags: [Categories]
 *     summary: Get all product categories as a tree structure
 *     responses:
 *       200: { description: List of categories with children }
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM categories ORDER BY parent_id NULLS FIRST, name');
    // Build tree
    const map  = {};
    const tree = [];
    result.rows.forEach(row => { map[row.id] = { ...row, children: [] }; });
    result.rows.forEach(row => {
      if (row.parent_id && map[row.parent_id]) {
        map[row.parent_id].children.push(map[row.id]);
      } else {
        tree.push(map[row.id]);
      }
    });
    res.json(tree as CategoryDTO[]);
  } catch (err) { res.status(500).json({ error: 'Server error' } as ErrorResponseDTO); }
});

export default router;
