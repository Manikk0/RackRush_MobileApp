// middleware: Authorization Bearer -> overenie JWT, vysledok do req.user
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export default function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Ocakavany format: Bearer <token>

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user; // Payload s user datami: { id, email, role }
    next();
  });
};
