import admin from 'firebase-admin';
import pool from '../config/db';

let firebaseReady = false;

// Inicializacia Firebase Admin SDK (ak su dostupne credentials)
function initFirebaseIfPossible() {
  if (firebaseReady) return;
  try {
    if (!admin.apps.length) {
      admin.initializeApp();
    }
    firebaseReady = true;
    console.log('Push service: Firebase initialized');
  } catch (err: any) {
    firebaseReady = false;
    console.warn('Push service: Firebase not initialized, fallback mode:', err?.message || err);
  }
}

initFirebaseIfPossible();

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  deepLink?: string;
}

// Poslanie push notifikacie vsetkym aktivnym zariadeniam usera
export async function sendPushToUser(userId: number, payload: PushPayload) {
  const tokensResult = await pool.query(
    'SELECT token FROM device_tokens WHERE user_id = $1 AND is_active = TRUE',
    [userId]
  );
  const tokens = tokensResult.rows.map((row) => row.token).filter(Boolean);

  if (!tokens.length) {
    return { sent: 0, skipped: true, reason: 'No active device tokens' };
  }

  // Ak nie je Firebase inicializovany, notifikaciu aspon zalogujeme
  if (!firebaseReady) {
    console.log('Push fallback log:', { userId, payload, tokensCount: tokens.length });
    return { sent: 0, skipped: true, reason: 'Firebase not initialized' };
  }

  const message: admin.messaging.MulticastMessage = {
    tokens,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: {
      ...(payload.data || {}),
      ...(payload.deepLink ? { deepLink: payload.deepLink } : {}),
    },
  };

  const response = await admin.messaging().sendEachForMulticast(message);

  // Neplatne tokeny deaktivujeme
  const invalidTokens: string[] = [];
  response.responses.forEach((r, i) => {
    if (!r.success) {
      const code = (r.error as any)?.code || '';
      if (code.includes('registration-token-not-registered') || code.includes('invalid-argument')) {
        invalidTokens.push(tokens[i]);
      }
    }
  });

  if (invalidTokens.length) {
    await pool.query(
      'UPDATE device_tokens SET is_active = FALSE WHERE user_id = $1 AND token = ANY($2)',
      [userId, invalidTokens]
    );
  }

  return {
    sent: response.successCount,
    failed: response.failureCount,
    invalidTokens: invalidTokens.length,
  };
}

