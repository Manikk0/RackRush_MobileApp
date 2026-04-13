// push: registracia device tokenov a odhlasenie (FCM/APNs cez pushService)
import { Request, Response } from 'express';
import { ErrorResponseDTO } from '../types';
const router = require('express').Router();
import pool from '../config/db';
import auth from '../middleware/auth';
import { sendPushToUser } from '../services/pushService';

const ALLOWED_PLATFORMS = ['android', 'ios'];

/**
 * @openapi
 * /api/notifications/devices:
 *   get:
 *     tags: [Notifications]
 *     summary: List current user's registered devices
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: List of devices }
 */
// zoznam registrovanych zariadeni pre push
router.get('/devices', auth, async (req: Request, res: Response) => {
  const result = await pool.query(
    `SELECT id, platform, token, is_active, created_at, last_used_at
     FROM device_tokens
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [req.user.id]
  );
  res.json(result.rows);
});

/**
 * @openapi
 * /api/notifications/devices/register:
 *   post:
 *     tags: [Notifications]
 *     summary: Register or reactivate device token for push notifications
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [platform, token]
 *             properties:
 *               platform: { type: string, enum: [android, ios] }
 *               token: { type: string }
 *     responses:
 *       200: { description: Device token saved }
 */
// AI-GENERATED
router.post('/devices/register', auth, async (req: Request, res: Response) => {
  const { platform, token } = req.body;
  if (!platform || !token) {
    return res.status(400).json({ error: 'platform and token required' } as ErrorResponseDTO);
  }
  if (!ALLOWED_PLATFORMS.includes(platform)) {
    return res.status(400).json({ error: 'platform must be android or ios' } as ErrorResponseDTO);
  }

  const result = await pool.query(
    `INSERT INTO device_tokens (user_id, platform, token, is_active, last_used_at)
     VALUES ($1, $2, $3, TRUE, NOW())
     ON CONFLICT (user_id, token)
     DO UPDATE SET platform = EXCLUDED.platform, is_active = TRUE, last_used_at = NOW()
     RETURNING *`,
    [req.user.id, platform, token]
  );
  res.json(result.rows[0]);
});

/**
 * @openapi
 * /api/notifications/devices/{id}:
 *   delete:
 *     tags: [Notifications]
 *     summary: Deactivate one registered device token
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Device deactivated }
 */
router.delete('/devices/:id', auth, async (req: Request, res: Response) => {
  const result = await pool.query(
    `UPDATE device_tokens
     SET is_active = FALSE
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [req.params.id, req.user.id]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'Device not found' } as ErrorResponseDTO);
  res.json({ message: 'Device deactivated' });
});

/**
 * @openapi
 * /api/notifications/test-push:
 *   post:
 *     tags: [Notifications]
 *     summary: Trigger a test push notification (app-triggered)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               body: { type: string }
 *               deepLink: { type: string }
 *     responses:
 *       200: { description: Push dispatch result }
 */
router.post('/test-push', auth, async (req: Request, res: Response) => {
  const title = req.body?.title || 'RackRush test';
  const body = req.body?.body || 'Test push from mobile app';
  const deepLink = req.body?.deepLink || 'rackrush://profile/notifications';

  const result = await sendPushToUser(req.user.id, {
    title,
    body,
    deepLink,
    data: { source: 'app', type: 'test_push' },
  });

  res.json({ message: 'Push request processed', result });
});

export default router;

