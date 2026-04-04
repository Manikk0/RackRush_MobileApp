import { Request, Response, NextFunction } from 'express';
import { StoreDTO, ErrorResponseDTO } from '../types';
// src/routes/stores.js
const router = require('express').Router();
import pool from '../config/db';

/**
 * @openapi
 * /api/stores:
 *   get:
 *     tags: [Stores]
 *     summary: Get all stores
 *     responses:
 *       200: { description: List of stores }
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM stores ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @openapi
 * /api/stores/nearby:
 *   get:
 *     tags: [Stores]
 *     summary: Find nearby stores based on coordinates
 *     parameters:
 *       - in: query
 *         name: lat
 *         required: true
 *         schema: { type: number }
 *       - in: query
 *         name: lng
 *         required: true
 *         schema: { type: number }
 *       - in: query
 *         name: radius
 *         schema: { type: number, default: 10000, description: Radius in meters }
 *     responses:
 *       200: { description: List of nearby stores }
 *       400: { description: Missing coordinates }
 */
router.get('/nearby', async (req: Request, res: Response) => {
  const { lat, lng, radius = 10000 } = req.query; // radius in meters
  if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });

  try {
    // Basic Haversine distance formula approximation in SQL
    // 6371 is Earth's radius in km
    const result = await pool.query(
      `SELECT *, 
        (6371 * acos(cos(radians($1)) * cos(radians(latitude)) * cos(radians(longitude) - radians($2)) + sin(radians($1)) * sin(radians(latitude)))) AS distance
       FROM stores
       WHERE (6371 * acos(cos(radians($1)) * cos(radians(latitude)) * cos(radians(longitude) - radians($2)) + sin(radians($1)) * sin(radians(latitude)))) < $3 / 1000
       ORDER BY distance`,
      [lat, lng, radius]
    );
    res.json(result.rows as StoreDTO[]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' } as ErrorResponseDTO);
  }
});

/**
 * @openapi
 * /api/stores/{id}:
 *   get:
 *     tags: [Stores]
 *     summary: Get specific store details
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Store details }
 *       404: { description: Store not found }
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM stores WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Store not found' } as ErrorResponseDTO);
    res.json(result.rows[0] as StoreDTO);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' } as ErrorResponseDTO);
  }
});

export default router;
