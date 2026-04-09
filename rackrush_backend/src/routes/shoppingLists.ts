import { Request, Response, NextFunction } from 'express';
import { ShoppingListDTO, ShoppingListItemDTO, ErrorResponseDTO } from '../types';
// Route modul pre nakupne zoznamy
const router = require('express').Router();
import pool from '../config/db';
import auth from '../middleware/auth';

/**
 * @openapi
 * /api/shopping-lists:
 *   get:
 *     tags: [Shopping Lists]
 *     summary: Get all shopping lists for user
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: List of shopping lists }
 */
router.get('/', auth, async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT * FROM shopping_lists WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows as ShoppingListDTO[]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' } as ErrorResponseDTO);
  }
});

/**
 * @openapi
 * /api/shopping-lists:
 *   post:
 *     tags: [Shopping Lists]
 *     summary: Create a new shopping list
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *     responses:
 *       201: { description: List created }
 */
router.post('/', auth, async (req: Request, res: Response) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' } as ErrorResponseDTO);
  try {
    const result = await pool.query(
      'INSERT INTO shopping_lists (user_id, name, updated_at, version) VALUES ($1, $2, NOW(), 1) RETURNING *',
      [req.user.id, name]
    );
    res.status(201).json(result.rows[0] as ShoppingListDTO);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' } as ErrorResponseDTO);
  }
});

/**
 * @openapi
 * /api/shopping-lists/sync:
 *   get:
 *     tags: [Shopping Lists]
 *     summary: Sync shopping lists and items changed since timestamp (offline support)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: updated_since
 *         required: true
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200: { description: Changed lists and items }
 */
router.get('/sync', auth, async (req: Request, res: Response) => {
  const updatedSince = req.query.updated_since as string;
  if (!updatedSince) return res.status(400).json({ error: 'updated_since required' } as ErrorResponseDTO);

  try {
    const lists = await pool.query(
      `SELECT * FROM shopping_lists
       WHERE user_id = $1 AND updated_at > $2
       ORDER BY updated_at ASC`,
      [req.user.id, updatedSince]
    );

    const items = await pool.query(
      `SELECT sli.*
       FROM shopping_list_items sli
       JOIN shopping_lists sl ON sl.id = sli.list_id
       WHERE sl.user_id = $1 AND sli.updated_at > $2
       ORDER BY sli.updated_at ASC`,
      [req.user.id, updatedSince]
    );

    res.json({ lists: lists.rows, items: items.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' } as ErrorResponseDTO);
  }
});

/**
 * @openapi
 * /api/shopping-lists/{id}:
 *   get:
 *     tags: [Shopping Lists]
 *     summary: Get shopping list details with all items
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: List details }
 *       404: { description: List not found }
 */
router.get('/:id', auth, async (req: Request, res: Response) => {
  try {
    const list = await pool.query(
      'SELECT * FROM shopping_lists WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
      [req.params.id, req.user.id]
    );
    if (!list.rows.length) return res.status(404).json({ error: 'List not found' } as ErrorResponseDTO);

    const items = await pool.query(
      `SELECT sli.*, p.name AS product_name, p.price, p.image_url
       FROM shopping_list_items sli
       JOIN products p ON p.id = sli.product_id
       WHERE sli.list_id = $1 AND sli.deleted_at IS NULL`,
      [req.params.id]
    );
    res.json({ ...(list.rows[0] as ShoppingListDTO), items: items.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' } as ErrorResponseDTO);
  }
});

/**
 * @openapi
 * /api/shopping-lists/{id}:
 *   put:
 *     tags: [Shopping Lists]
 *     summary: Rename a shopping list
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
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *     responses:
 *       200: { description: List renamed }
 */
router.put('/:id', auth, async (req: Request, res: Response) => {
  const { name, expected_version } = req.body;
  try {
    // Jednoducha kontrola konfliktov pre offline sync
    if (expected_version !== undefined) {
      const current = await pool.query(
        'SELECT version FROM shopping_lists WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
        [req.params.id, req.user.id]
      );
      if (!current.rows.length) return res.status(404).json({ error: 'List not found' } as ErrorResponseDTO);
      if (Number(current.rows[0].version) !== Number(expected_version)) {
        return res.status(409).json({ error: 'Version conflict', current_version: current.rows[0].version });
      }
    }

    const result = await pool.query(
      `UPDATE shopping_lists
       SET name = COALESCE($1, name), updated_at = NOW(), version = version + 1
       WHERE id = $2 AND user_id = $3 AND deleted_at IS NULL
       RETURNING *`,
      [name, req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'List not found' } as ErrorResponseDTO);
    res.json(result.rows[0] as ShoppingListDTO);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' } as ErrorResponseDTO);
  }
});

/**
 * @openapi
 * /api/shopping-lists/{id}:
 *   delete:
 *     tags: [Shopping Lists]
 *     summary: Delete a shopping list
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: List deleted }
 */
router.delete('/:id', auth, async (req: Request, res: Response) => {
  try {
    // Soft delete, aby klienti v offline sync dostali informaciu o zmazani
    const result = await pool.query(
      `UPDATE shopping_lists
       SET deleted_at = NOW(), updated_at = NOW(), version = version + 1
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'List not found' } as ErrorResponseDTO);

    // Pri zmazani zoznamu oznacime aj jeho itemy ako deleted
    await pool.query(
      `UPDATE shopping_list_items
       SET deleted_at = NOW(), updated_at = NOW(), version = version + 1
       WHERE list_id = $1 AND deleted_at IS NULL`,
      [req.params.id]
    );

    res.json({ message: 'List deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' } as ErrorResponseDTO);
  }
});

/**
 * @openapi
 * /api/shopping-lists/{id}/items:
 *   post:
 *     tags: [Shopping Lists]
 *     summary: Add product to shopping list
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
 *             required: [product_id]
 *             properties:
 *               product_id: { type: integer }
 *     responses:
 *       201: { description: Item added }
 */
router.post('/:id/items', auth, async (req: Request, res: Response) => {
  const { product_id } = req.body;
  if (!product_id) return res.status(400).json({ error: 'product_id required' } as ErrorResponseDTO);
  try {
    const list = await pool.query(
      'SELECT id FROM shopping_lists WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
      [req.params.id, req.user.id]
    );
    if (!list.rows.length) return res.status(404).json({ error: 'List not found' } as ErrorResponseDTO);

    const result = await pool.query(
      `INSERT INTO shopping_list_items (list_id, product_id, updated_at, version)
       VALUES ($1, $2, NOW(), 1) RETURNING *`,
      [req.params.id, product_id]
    );
    res.status(201).json(result.rows[0] as ShoppingListItemDTO);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' } as ErrorResponseDTO);
  }
});

/**
 * @openapi
 * /api/shopping-lists/{id}/items/{itemId}:
 *   patch:
 *     tags: [Shopping Lists]
 *     summary: Toggle item checked status
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [is_checked]
 *             properties:
 *               is_checked: { type: boolean }
 *     responses:
 *       200: { description: Item status updated }
 */
router.patch('/:id/items/:itemId', auth, async (req: Request, res: Response) => {
  const { is_checked, expected_version } = req.body;
  try {
    if (expected_version !== undefined) {
      const current = await pool.query(
        `SELECT sli.version
         FROM shopping_list_items sli
         JOIN shopping_lists sl ON sl.id = sli.list_id
         WHERE sli.id = $1 AND sl.user_id = $2 AND sli.deleted_at IS NULL`,
        [req.params.itemId, req.user.id]
      );
      if (!current.rows.length) return res.status(404).json({ error: 'Item not found' } as ErrorResponseDTO);
      if (Number(current.rows[0].version) !== Number(expected_version)) {
        return res.status(409).json({ error: 'Version conflict', current_version: current.rows[0].version });
      }
    }

    const result = await pool.query(
      `UPDATE shopping_list_items sli
       SET is_checked = $1, updated_at = NOW(), version = version + 1
       FROM shopping_lists sl
       WHERE sli.id = $2 AND sli.list_id = sl.id AND sl.user_id = $3 AND sli.deleted_at IS NULL
       RETURNING sli.*`,
      [is_checked, req.params.itemId, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Item not found' } as ErrorResponseDTO);
    res.json(result.rows[0] as ShoppingListItemDTO);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' } as ErrorResponseDTO);
  }
});

/**
 * @openapi
 * /api/shopping-lists/{id}/items/{itemId}:
 *   delete:
 *     tags: [Shopping Lists]
 *     summary: Remove item from shopping list
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Item removed }
 */
router.delete('/:id/items/:itemId', auth, async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `UPDATE shopping_list_items sli
       SET deleted_at = NOW(), updated_at = NOW(), version = version + 1
       FROM shopping_lists sl
       WHERE sli.id = $1 AND sli.list_id = sl.id AND sl.user_id = $2 AND sli.deleted_at IS NULL
       RETURNING sli.id`,
      [req.params.itemId, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Item not found' } as ErrorResponseDTO);
    res.json({ message: 'Item removed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' } as ErrorResponseDTO);
  }
});

export default router;
