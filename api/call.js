const admin = require('firebase-admin');

// Initialize Firebase Admin securely from Vercel Environment Variables
if (!admin.apps.length) {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('Firebase Admin initialized for Vercel Serverless');
    } else {
      console.warn('FIREBASE_SERVICE_ACCOUNT is not set in Vercel Env!');
    }
  } catch (error) {
    console.error('Firebase initialization error:', error);
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

  const { targetToken, callerName, roomId } = req.body;

  if (!targetToken) {
    return res.status(400).json({ error: 'targetToken is required' });
  }

  if (!admin.apps.length) {
    return res.status(500).json({ error: 'Firebase Admin not configured on server (Missing FIREBASE_SERVICE_ACCOUNT env)' });
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
        action: 'incoming_call'
      },
      android: {
        priority: 'high',
      }
    });

    console.log('Successfully sent message:', response);
    return res.status(200).json({ success: true, response });
  } catch (error) {
    console.error('Error sending message:', error);
    return res.status(500).json({ error: error.message });
  }
}
