import { Request, Response, NextFunction } from 'express';
import { StoreDTO, ErrorResponseDTO } from '../types';
// Route modul pre predajne
const router = require('express').Router();
import pool from '../config/db';

// Pomocna funkcia: PostgreSQL POINT sa vrati ako "(x,y)"
// x = longitude, y = latitude
function parsePgPoint(pointValue: string | null): { longitude: number; latitude: number } | null {
  if (!pointValue || typeof pointValue !== 'string') return null;
  const cleaned = pointValue.replace('(', '').replace(')', '');
  const parts = cleaned.split(',');
  if (parts.length !== 2) return null;

  const longitude = Number(parts[0]);
  const latitude = Number(parts[1]);
  if (Number.isNaN(longitude) || Number.isNaN(latitude)) return null;

  return { longitude, latitude };
}

// Jednoducha funkcia na vypocet vzdialenosti v km 
function distanceInKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

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
  const { lat, lng, radius = 10000 } = req.query; // radius v metroch
  if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });

  try {
    const latNum = Number(lat);
    const lngNum = Number(lng);
    const radiusMeters = Number(radius);
    if (Number.isNaN(latNum) || Number.isNaN(lngNum) || Number.isNaN(radiusMeters)) {
      return res.status(400).json({ error: 'lat, lng a radius musia byt cisla' } as ErrorResponseDTO);
    }

    // Namiesto komplikovaneho SQL to robime citatelne v JS:
    // 1) nacitame predajne, 2) vypocitame vzdialenost, 3) odfiltrujeme podla radiusu
    const result = await pool.query('SELECT * FROM stores');
    const maxDistanceKm = radiusMeters / 1000;

    // Jednoduchy "for" styl:
    // 1) prejdeme vsetky predajne
    // 2) spocitame vzdialenost
    // 3) ulozime len tie v rameci radiusu
    const nearbyStores: any[] = [];
    for (const store of result.rows) {
      const location = parsePgPoint(store.location);
      if (!location) {
        continue;
      }

      const distance = distanceInKm(latNum, lngNum, location.latitude, location.longitude);
      if (distance <= maxDistanceKm) {
        nearbyStores.push({
          ...store,
          distance,
        });
      }
    }

    // Zoradenie od najblizsej predajne
    nearbyStores.sort((a, b) => a.distance - b.distance);

    res.json(nearbyStores as StoreDTO[]);
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
