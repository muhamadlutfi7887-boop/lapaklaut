import Redis from 'ioredis';

const mem = new Map();
const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1 }) : null;
if (redis) redis.on('error', (e) => console.error('[redis]', e.message));
export const cacheDriver = redis ? 'redis' : 'memory';

export async function cget(key) {
  try {
    if (redis) { const v = await redis.get('ll:' + key); return v ? JSON.parse(v) : null; }
    const e = mem.get(key);
    if (e && e.exp > Date.now()) return e.v;
    mem.delete(key);
  } catch { }
  return null;
}

export async function cset(key, val, ttl = 60) {
  try {
    if (redis) await redis.set('ll:' + key, JSON.stringify(val), 'EX', ttl);
    else mem.set(key, { v: val, exp: Date.now() + ttl * 1000 });
  } catch {  }
}

export async function cdel(prefix) {
  try {
    if (redis) { const keys = await redis.keys('ll:' + prefix + '*'); if (keys.length) await redis.del(keys); }
    else for (const k of mem.keys()) if (k.startsWith(prefix)) mem.delete(k);
  } catch {  }
}

export const cached = (prefix, ttl) => async (req, res, next) => {
  const key = prefix + ':' + req.originalUrl;
  const hit = await cget(key);
  if (hit) { res.set('X-Cache', 'HIT'); return res.json(hit); }
  res.set('X-Cache', 'MISS');
  const send = res.json.bind(res);
  res.json = (body) => { if (res.statusCode === 200) cset(key, body, ttl); return send(body); };
  next();
};
