import { Request, Response, NextFunction } from 'express';
import { UserDTO, UserPreferencesDTO, UserNotificationsDTO, ErrorResponseDTO } from '../types';
// Route modul pre pracu s profilom pouzivatela
const router = require('express').Router();
import bcrypt from 'bcryptjs';
import pool from '../config/db';
import auth from '../middleware/auth';

/**
 * @openapi
 * /api/users/me:
 *   get:
 *     tags: [Users]
 *     summary: Get current user profile
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: User profile data }
 *       401: { description: Unauthorized }
 */
router.get('/me', auth, async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, full_name, email, date_of_birth, role, location, profile_image, created_at
       FROM users WHERE id = $1`, [req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' } as ErrorResponseDTO);
    res.json(result.rows[0] as UserDTO);
  } catch (err) { res.status(500).json({ error: 'Server error' } as ErrorResponseDTO); }
});

/**
 * @openapi
 * /api/users/me:
 *   put:
 *     tags: [Users]
 *     summary: Update current user profile
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               full_name: { type: string }
 *               date_of_birth: { type: string, format: date }
 *               longitude: { type: number }
 *               latitude: { type: number }
 *               profile_image: { type: string }
 *     responses:
 *       200: { description: Profile updated }
 */
router.put('/me', auth, async (req: Request, res: Response) => {
  const { full_name, date_of_birth, longitude, latitude, profile_image } = req.body;
  try {
    let query = `UPDATE users SET
         full_name     = COALESCE($1, full_name),
         date_of_birth = COALESCE($2, date_of_birth),
         profile_image = COALESCE($3, profile_image)`;
    const vals: any[] = [full_name, date_of_birth, profile_image];
    
    if (longitude !== undefined && latitude !== undefined) {
      query += `, location = POINT($4, $5)`;
      vals.push(longitude, latitude);
    }
    
    query += ` WHERE id = $${vals.length + 1} RETURNING id, full_name, email, date_of_birth, role, location, profile_image`;
    vals.push(req.user.id);

    const result = await pool.query(query, vals);
    res.json(result.rows[0] as UserDTO);
  } catch (err) { 
    console.error(err);
    res.status(500).json({ error: 'Server error' } as ErrorResponseDTO); 
  }
});

/**
 * @openapi
 * /api/users/me/password:
 *   put:
 *     tags: [Users]
 *     summary: Change user password
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [current_password, new_password]
 *             properties:
 *               current_password: { type: string }
 *               new_password: { type: string }
 *     responses:
 *       200: { description: Password updated }
 *       401: { description: Incorrect current password }
 */
router.put('/me/password', auth, async (req: Request, res: Response) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) return res.status(400).json({ error: 'Both passwords required' } as ErrorResponseDTO);
  try {
    const user = (await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id])).rows[0];
    const valid = await bcrypt.compare(current_password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' } as ErrorResponseDTO);

    const hash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);
    res.json({ message: 'Password updated' });
  } catch (err) { res.status(500).json({ error: 'Server error' } as ErrorResponseDTO); }
});

/**
 * @openapi
 * /api/users/me:
 *   delete:
 *     tags: [Users]
 *     summary: Delete current user account (Permanently)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Account deleted }
 */
router.delete('/me', auth, async (req: Request, res: Response) => {
  try {
    // V aktualnej schema users nema stlpec is_active.
    // Preto pouzivame realne zmazanie usera a naviazane data sa zmazu cez ON DELETE CASCADE.
    await pool.query('DELETE FROM users WHERE id = $1', [req.user.id]);
    res.json({ message: 'Account deleted' });
  } catch (err) { res.status(500).json({ error: 'Server error' } as ErrorResponseDTO); }
});

/**
 * @openapi
 * /api/users/me/preferences:
 *   get:
 *     tags: [Users]
 *     summary: Get user UI preferences
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Preferences data }
 */
router.get('/me/preferences', auth, async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM user_preferences WHERE user_id = $1', [req.user.id]);
    res.json((result.rows[0] || {}) as UserPreferencesDTO);
  } catch (err) { res.status(500).json({ error: 'Server error' } as ErrorResponseDTO); }
});

/**
 * @openapi
 * /api/users/me/preferences:
 *   put:
 *     tags: [Users]
 *     summary: Update user UI preferences
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               language: { type: string, enum: [sk, en, cz] }
 *               theme_mode: { type: boolean }
 *               high_contrast_mode: { type: boolean }
 *               font_size: { type: integer }
 *               reading_out_loud: { type: boolean }
 *               simple_navigation: { type: boolean }
 *               region: { type: string }
 *               data_privacy_consent: { type: boolean }
 *               terms_of_service: { type: boolean }
 *     responses:
 *       200: { description: Preferences updated }
 */
router.put('/me/preferences', auth, async (req: Request, res: Response) => {
  const fields = ['language','theme_mode','high_contrast_mode','font_size','reading_out_loud',
                  'simple_navigation','region','data_privacy_consent','terms_of_service'];
  const updates = [];
  const values  = [];
  let   idx     = 1;
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = $${idx++}`);
      values.push(f === 'font_size' ? parseInt(req.body[f]) : req.body[f]);
    }
  }
  if (!updates.length) return res.status(400).json({ error: 'No fields to update' } as ErrorResponseDTO);
  values.push(req.user.id);
  try {
    const result = await pool.query(
      `UPDATE user_preferences SET ${updates.join(', ')} WHERE user_id = $${idx} RETURNING *`,
      values
    );
    res.json(result.rows[0] as UserPreferencesDTO);
  } catch (err) { res.status(500).json({ error: 'Server error' } as ErrorResponseDTO); }
});

/**
 * @openapi
 * /api/users/me/notifications:
 *   get:
 *     tags: [Users]
 *     summary: Get user notification settings
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Notifications data }
 */
router.get('/me/notifications', auth, async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM user_notifications WHERE user_id = $1', [req.user.id]);
    res.json((result.rows[0] || {}) as UserNotificationsDTO);
  } catch (err) { res.status(500).json({ error: 'Server error' } as ErrorResponseDTO); }
});

/**
 * @openapi
 * /api/users/me/notifications:
 *   put:
 *     tags: [Users]
 *     summary: Update user notification settings
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               order_status: { type: boolean }
 *               delivery_app: { type: boolean }
 *               news_letter_app: { type: boolean }
 *               unused_points: { type: boolean }
 *               suspicious_activity: { type: boolean }
 *               favorite_product_sale: { type: boolean }
 *               unfinished_order: { type: boolean }
 *               news_letter_email: { type: boolean }
 *               delivery_sms: { type: boolean }
 *               sale_sms: { type: boolean }
 *               sale_email: { type: boolean }
 *               verification_code_sms: { type: boolean }
 *               verification_code_email: { type: boolean }
 *               exclusive_code: { type: boolean }
 *               news_email: { type: boolean }
 *               feedback: { type: boolean }
 *               invoice: { type: boolean }
 *     responses:
 *       200: { description: Notifications updated }
 */
router.put('/me/notifications', auth, async (req: Request, res: Response) => {
  const fields = ['order_status','delivery_app','news_letter_app','unused_points','suspicious_activity',
                  'favorite_product_sale','unfinished_order','news_letter_email','delivery_sms',
                  'sale_sms','sale_email','verification_code_sms',
                  'verification_code_email','exclusive_code','news_email','feedback','invoice'];
  const updates = [];
  const values  = [];
  let   idx     = 1;
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = $${idx++}`);
      values.push(req.body[f]);
    }
  }
  if (!updates.length) return res.status(400).json({ error: 'No fields to update' } as ErrorResponseDTO);
  values.push(req.user.id);
  try {
    const result = await pool.query(
      `UPDATE user_notifications SET ${updates.join(', ')} WHERE user_id = $${idx} RETURNING *`,
      values
    );
    res.json(result.rows[0] as UserNotificationsDTO);
  } catch (err) { res.status(500).json({ error: 'Server error' } as ErrorResponseDTO); }
});

export default router;
