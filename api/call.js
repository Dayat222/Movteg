import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');

function getFirebaseAdmin() {
  if (admin.getApps().length) {
    return { ok: true };
  }

  const rawEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!rawEnv) {
    return { ok: false, reason: 'process.env.FIREBASE_SERVICE_ACCOUNT is empty or undefined' };
  }

  try {
    let serviceAccount;
    if (typeof rawEnv === 'string') {
      const trimmed = rawEnv.trim();
      serviceAccount = JSON.parse(trimmed);
    } else {
      serviceAccount = rawEnv;
    }

    // If private_key has literal escaped \n, replace them with actual newlines
    if (serviceAccount && serviceAccount.private_key && serviceAccount.private_key.includes('\\n')) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });

    console.log('[Firebase] Admin successfully initialized');
    return { ok: true };
  } catch (err) {
    console.error('[Firebase] Init error:', err);
    return { ok: false, reason: err.message || String(err) };
  }
}

export default async function handler(req, res) {
  // CORS setup
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { targetToken, callerName, roomId } = req.body || {};

  if (!targetToken) {
    return res.status(400).json({ error: 'targetToken is required' });
  }

  const fbStatus = getFirebaseAdmin();
  if (!fbStatus.ok) {
    return res.status(500).json({ 
      error: 'Firebase Admin not configured on server', 
      reason: fbStatus.reason 
    });
  }

  try {
    const response = await admin.messaging().send({
      token: targetToken,
      notification: {
        title: '📞 Panggilan Video Movteg',
        body: `${callerName || 'Pasangan'} memanggilmu! Ketuk untuk menjawab.`,
      },
      data: {
        room: roomId || '',
        action: 'incoming_call',
        callerName: callerName || 'Pasangan'
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'calls',
          priority: 'max'
        }
      }
    });

    return res.status(200).json({ success: true, messageId: response });
  } catch (sendError) {
    console.error('[FCM] Send error:', sendError);
    return res.status(500).json({ 
      error: 'Failed to send push notification', 
      details: sendError.message || String(sendError) 
    });
  }
}
