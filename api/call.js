import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');

function getFirebaseMessaging() {
  if (getApps().length > 0) {
    return { ok: true, messaging: getMessaging() };
  }

  const rawEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!rawEnv) {
    return { ok: false, reason: 'process.env.FIREBASE_SERVICE_ACCOUNT is empty or undefined' };
  }

  try {
    let serviceAccount;
    if (typeof rawEnv === 'string') {
      let trimmed = rawEnv.trim();
      // If user pasted "KEY=VALUE" (e.g. FIREBASE_SERVICE_ACCOUNT={"type":...})
      if (trimmed.includes('=') && !trimmed.startsWith('{')) {
        trimmed = trimmed.slice(trimmed.indexOf('=') + 1).trim();
      }
      // If user wrapped the entire JSON in single or double quotes
      if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
        trimmed = trimmed.slice(1, -1).trim();
      }
      serviceAccount = JSON.parse(trimmed);
    } else {
      serviceAccount = rawEnv;
    }

    // If private_key has literal escaped \n, replace them with actual newlines
    if (serviceAccount && serviceAccount.private_key && serviceAccount.private_key.includes('\\n')) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }

    const app = initializeApp({
      credential: cert(serviceAccount)
    });

    console.log('[Firebase] Admin successfully initialized');
    return { ok: true, messaging: getMessaging(app) };
  } catch (err) {
    console.error('[Firebase] Init error:', err);
    return { 
      ok: false, 
      reason: err.message || String(err),
      envLength: typeof rawEnv === 'string' ? rawEnv.length : 0,
      envStart: typeof rawEnv === 'string' ? rawEnv.substring(0, 35) : 'not_string'
    };
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

  const fb = getFirebaseMessaging();
  if (!fb.ok) {
    return res.status(500).json({ 
      error: 'Firebase Admin not configured on server', 
      reason: fb.reason,
      envLength: fb.envLength,
      envStart: fb.envStart
    });
  }

  try {
    const response = await fb.messaging.send({
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
          channelId: 'calls_v2',
          priority: 'max',
          defaultSound: true,
          defaultVibrateTimings: true,
          visibility: 'public'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default'
          }
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
