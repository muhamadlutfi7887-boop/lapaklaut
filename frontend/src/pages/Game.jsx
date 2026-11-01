import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, errMsg, R } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Cover } from '../ui.jsx';

export default function Game() {
  const { slug } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [g, setG] = useState(null);
  const [methods, setMethods] = useState([]);
  const [f, setF] = useState([]);
  const [pid, setPid] = useState(null);
  const [m, setM] = useState(null);
  const [code, setCode] = useState('');
  const [promo, setPromo] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/games/' + slug).then((r) => setG(r.data)).catch((e) => setErr(errMsg(e)));
    api.get('/payment-methods').then((r) => setMethods(r.data));
  }, [slug]);

  if (!g) return <div className="c ctr" style={{ marginTop: 14 }}>{err || 'Memuat…'}</div>;

  const prod = g.products.find((p) => p.id === pid);
  const method = methods.find((x) => x.code === m);
  const sub = prod?.price || 0, fee = method?.fee || 0, disc = promo?.discount || 0, total = sub + fee - disc;

  async function applyPromo() {
    setErr('');
    if (!prod) return setErr('Pilih nominal dulu sebelum memakai promo');
    try { setPromo((await api.get('/promos/check', { params: { code, amount: sub } })).data); }
    catch (e) { setPromo(null); setErr(errMsg(e)); }
  }

  async function buy() {
    setErr('');
    const bad = g.fields.map((x, i) => (new RegExp(x.pattern).test((f[i] || '').trim()) ? null : `${x.label} tidak valid (${x.hint})`)).filter(Boolean);
    if (!pid) bad.push('Pilih nominal');
    if (!m) bad.push('Pilih metode pembayaran');
    if (bad.length) return setErr(bad.join('\n'));
    if (!user) return nav('/login', { state: { from: '/game/' + slug } });
    setBusy(true);
    try {
      const { data } = await api.post('/orders', { productId: pid, target: g.fields.map((_, i) => (f[i] || '').trim()), method: m, promoCode: promo?.code });
      nav('/orders/' + data.id);
    } catch (e) { setErr(errMsg(e)); }
    setBusy(false);
  }

  return (
    <>
      <p><Link to="/" className="ch" style={{ textDecoration: 'none' }}>← Kembali</Link></p>
      <div className="dg">
        <div>
          <div className="c" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{ width: 72, flex: 'none' }}><Cover g={g} /></div>
            <div><h2 style={{ margin: 0 }}>{g.name}</h2><span className="mu">{g.category} · Proses instan</span></div>
          </div>

          <h3>1. Masukkan data akun</h3>
          <div className="c">
            {g.fields.map((x, i) => (
              <div key={i}>
                <label className="mu">{x.label} <small>({x.hint})</small></label>
                <input className="in" placeholder={x.label} value={f[i] || ''} style={{ margin: '4px 0 10px' }}
                  onChange={(e) => { const n = [...f]; n[i] = e.target.value; setF(n); }} />
              </div>
            ))}
          </div>

          <h3>2. Pilih nominal</h3>
          <div className="nm">
            {g.products.map((p) => (
              <button key={p.id} className={'op ' + (p.id === pid ? 'on' : '')} onClick={() => { setPid(p.id); setPromo(null); }}>
                <b>{p.label}</b><br /><span className="pc">{R(p.price)}</span>
                {p.stock !== null && <><br /><small className="mu">Sisa {p.stock}</small></>}
              </button>
            ))}
          </div>

          <h3>3. Metode pembayaran</h3>
          <div className="nm">
            {methods.map((x) => (
              <button key={x.code} className={'op ' + (x.code === m ? 'on' : '')} onClick={() => setM(x.code)}>
                <b>{x.name}</b><br /><small className="mu">Biaya {R(x.fee)}</small>
              </button>
            ))}
          </div>

          <h3>4. Kode promo</h3>
          <div className="c" style={{ display: 'flex', gap: 8 }}>
            <input className="in" placeholder="LAUT10 / HEMAT5K / NEWUSER" value={code} onChange={(e) => setCode(e.target.value)} />
            <button className="bt bs" onClick={applyPromo}>Pakai</button>
          </div>
        </div>

        <div className="c" style={{ position: 'sticky', top: 90 }}>
          <h3 style={{ marginTop: 0 }}>Ringkasan</h3>
          <div className="row"><span className="mu">Item</span><span>{prod?.label || '-'}</span></div>
          <div className="row"><span className="mu">Harga</span><span>{R(sub)}</span></div>
          <div className="row"><span className="mu">Biaya layanan</span><span>{R(fee)}</span></div>
          <div className="row"><span className="mu">Diskon {promo?.code || ''}</span><span>-{R(disc)}</span></div>
          <div className="row tot"><span>Total</span><span className="pc">{R(total)}</span></div>
          <div className="er mo">{err}</div>
          <button className="bt" onClick={buy} disabled={busy}>{busy ? 'Memproses…' : 'Beli Sekarang'}</button>
        </div>
      </div>
    </>
  );
}
