import express from 'express';

const PORT = process.env.PORT || 5000;
const SERVICE_KEY = process.env.SERVICE_KEY || 'dev-service-key';
const CALLBACK_URL = process.env.CALLBACK_URL || 'http://localhost:4000/api/fulfillment/callback';
const CALLBACK_TOKEN = process.env.CALLBACK_TOKEN || 'rahasia-webhook';
const DELAY_MS = Number(process.env.DELAY_MS || 2000);

const app = express();
app.use(express.json({ limit: '50kb' }));

app.get('/health', (req, res) => res.json({ ok: true, service: 'fulfillment' }));

app.post('/topup', (req, res) => {
  if (req.headers['x-service-key'] !== SERVICE_KEY) return res.status(401).json({ message: 'Service key salah' });
  const { orderId, target, item } = req.body || {};
  if (!Number.isInteger(orderId) || !target) return res.status(422).json({ message: 'orderId (angka) dan target wajib diisi' });

  const providerRef = 'PRV-' + Date.now().toString(36).toUpperCase();
  res.status(202).json({ accepted: true, providerRef });
  console.log(`[topup] order ${orderId} ${item} -> ${target} (${providerRef})`);

  setTimeout(() => sendResult(orderId, providerRef, !String(target).trim().endsWith('000')), DELAY_MS);
});

async function sendResult(orderId, providerRef, ok, attempt = 1) {
  try {
    const r = await fetch(CALLBACK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-callback-token': CALLBACK_TOKEN },
      body: JSON.stringify({ orderId, providerRef, status: ok ? 'success' : 'failed' }),
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) throw new Error('callback membalas ' + r.status);
    console.log(`[callback] order ${orderId} ${ok ? 'success' : 'failed'}`);
  } catch (e) {
    console.error(`[callback] percobaan ${attempt} gagal: ${e.message}`);
    if (attempt < 3) setTimeout(() => sendResult(orderId, providerRef, ok, attempt + 1), 2000 * attempt);
  }
}

app.listen(PORT, () => console.log(`Fulfillment service jalan di http://localhost:${PORT}`));
