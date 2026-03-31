import { Request, Response, NextFunction } from 'express';
import { ErrorResponseDTO } from '../types';
// src/routes/upload.js
const router = require('express').Router();
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import auth from '../middleware/auth';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed') as any);
  }
});

/**
 * @openapi
 * /api/upload/image:
 *   post:
 *     tags: [Upload]
 *     summary: Upload an image (Profile, Product, etc.)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200: { description: Image uploaded successfully, returns URL }
 *       400: { description: Invalid file or no file uploaded }
 */
router.post('/image', auth, (req: Request, res: Response, next: NextFunction) => {
  upload.single('image')(req, res, (err: any) => {
    if (err instanceof multer.MulterError) return res.status(400).json({ error: err.message } as ErrorResponseDTO);
    if (err) return res.status(400).json({ error: err.message } as ErrorResponseDTO);
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' } as ErrorResponseDTO);
    
    const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    res.json({ url });
  });
});

export default router;
