import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, errMsg, fmtDate, R } from '../api.js';
import { Badge, Pager } from '../ui.jsx';

export function OrderList() {
  const nav = useNavigate();
  const [page, setPage] = useState(1);
  const [res, setRes] = useState({ data: [], meta: null });
  useEffect(() => { api.get('/orders/me', { params: { page, limit: 8 } }).then((r) => setRes(r.data)); }, [page]);
  return (
    <>
      <h3>Riwayat Pesanan</h3>
      {res.data.map((o) => (
        <div key={o.id} className="c row" style={{ cursor: 'pointer', marginBottom: 8 }} onClick={() => nav('/orders/' + o.id)}>
          <div><b>{o.itemLabel}</b><br /><small className="mu">{o.invoice} · {fmtDate(o.createdAt)}</small></div>
          <div style={{ textAlign: 'right' }}><b>{R(o.total)}</b><br /><Badge s={o.status} /></div>
        </div>
      ))}
      {res.meta && !res.data.length && <div className="c ctr">Belum ada pesanan. <Link to="/">Top up game pertamamu</Link></div>}
      <Pager meta={res.meta} onPage={setPage} />
    </>
  );
}

const STEPS = ['pending', 'paid', 'processing', 'success'];
const LABEL = ['Dipesan', 'Dibayar', 'Diproses', 'Berhasil'];

export function OrderDetail() {
  const { id } = useParams();
  const [o, setO] = useState(null);
  const [err, setErr] = useState('');
  const load = useCallback(() => api.get('/orders/' + id).then((r) => setO(r.data)).catch((e) => setErr(errMsg(e))), [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!o || !['paid', 'processing'].includes(o.status)) return;
    const t = setTimeout(load, 1500);
    return () => clearTimeout(t);
  }, [o, load]);

  async function pay() {
    setErr('');
    try { await api.post(`/orders/${id}/simulate-pay`); load(); } catch (e) { setErr(errMsg(e)); }
  }

  if (!o) return <div className="c ctr" style={{ marginTop: 14 }}>{err || 'Memuat…'}</div>;
  const ix = STEPS.indexOf(o.status);
  return (
    <div className="c" style={{ maxWidth: 460, margin: '20px auto' }}>
      <div className="row"><b>Invoice</b><Badge s={o.status} /></div>
      <p className="mu" style={{ margin: 0 }}>{o.invoice}<br />{fmtDate(o.createdAt)}</p>
      {ix >= 0 && <div className="tl">{LABEL.map((l, i) => <div key={l} className={i <= ix ? 'd' : ''}>{l}</div>)}</div>}
      <div className="row"><span className="mu">Item</span><span>{o.itemLabel}</span></div>
      <div className="row"><span className="mu">Akun tujuan</span><span>{o.target}</span></div>
      <div className="row"><span className="mu">Pembayaran</span><span>{o.payment?.method}</span></div>
      <div className="row"><span className="mu">Harga</span><span>{R(o.price)}</span></div>
      <div className="row"><span className="mu">Biaya layanan</span><span>{R(o.fee)}</span></div>
      <div className="row"><span className="mu">Diskon</span><span>-{R(o.discount)}</span></div>
      <div className="row tot"><span>Total</span><span className="pc">{R(o.total)}</span></div>
      {o.status === 'pending' && (
        <>
          <button className="bt" onClick={pay}>Bayar Sekarang (simulasi)</button>
          <p className="mu" style={{ fontSize: 12 }}>Bayar sebelum {fmtDate(o.expiresAt)}, setelah itu pesanan kedaluwarsa.</p>
        </>
      )}
      {o.status === 'failed' && <p className="er">Top up gagal diproses provider. Hubungi bantuan untuk pengembalian dana.</p>}
      <div className="er mo">{err}</div>
      <Link to="/orders" className="mu">← Semua pesanan</Link>
    </div>
  );
}
