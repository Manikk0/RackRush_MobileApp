import { Request, Response, NextFunction } from 'express';
// src/app.js
import express from 'express';
import cors from 'cors';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';

const app = express();

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

// Middleware vrstva
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Nastavenie Swagger dokumentacie
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'RackRush Backend API',
      version: '1.0.1',
      description: 'API Documentation for the RackRush grocery loyalty application.',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development Server',
      },
      {
        url: 'http://192.168.214.22',
        description: 'viktor',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/*.ts'], // Cesta k API komentarom
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Registracia route modulov
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import productRoutes from './routes/products';
import categoryRoutes from './routes/categories';
import orderRoutes from './routes/orders';
import receiptRoutes from './routes/receipts';
import rewardRoutes from './routes/rewards';
import loyaltyCardRoutes from './routes/loyaltyCard';
import shoppingListRoutes from './routes/shoppingLists';
import favoriteRoutes from './routes/favorites';
import storeRoutes from './routes/stores';
import subRoutes from './routes/subscriptions';
import pmRoutes from './routes/paymentMethods';
import uploadRoutes from './routes/upload';
import adminRoutes from './routes/admin';
import notificationRoutes from './routes/notifications';

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/receipts', receiptRoutes);
app.use('/api/rewards', rewardRoutes);
app.use('/api/loyalty-card', loyaltyCardRoutes);
app.use('/api/shopping-lists', shoppingListRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/subscriptions', subRoutes);
app.use('/api/payment-methods', pmRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);

// Kontrola, ze API bezi
app.get('/', (req: Request, res: Response) => res.json({ message: 'RackRush Backend API is running' }));

export default app;
