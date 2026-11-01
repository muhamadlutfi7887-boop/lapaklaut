import { useCallback, useEffect, useState } from 'react';
import { api, errMsg, fmtDate, R } from '../api.js';
import { Pager } from '../ui.jsx';

export function ReportDownload() {
  const [q, setQ] = useState({ from: '', to: '' });
  const [msg, setMsg] = useState('');
  async function dl(format) {
    setMsg('');
    try {
      const r = await api.get('/admin/report/export', { params: { format, ...q }, responseType: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(r.data);
      a.download = `laporan-penjualan.${format}`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch { setMsg('Gagal mengunduh laporan'); }
  }
  return (
    <div className="c" style={{ marginTop: 12 }}>
      <b>Download laporan penjualan</b>
      <div className="fm">
        <div><label className="mu">Dari tanggal</label><input className="in" type="date" value={q.from} onChange={(e) => setQ({ ...q, from: e.target.value })} /></div>
        <div><label className="mu">Sampai tanggal</label><input className="in" type="date" value={q.to} onChange={(e) => setQ({ ...q, to: e.target.value })} /></div>
        <button className="bt bs" onClick={() => dl('xlsx')}>Unduh Excel</button>
        <button className="bt bs" onClick={() => dl('pdf')}>Unduh PDF</button>
      </div>
      <div className="er">{msg}</div>
    </div>
  );
}

export function Categories() {
  const [list, setList] = useState([]);
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');
  const load = useCallback(() => api.get('/admin/categories').then((r) => setList(r.data)), []);
  useEffect(() => { load(); }, [load]);
  const run = async (fn) => { setMsg(''); try { await fn(); setName(''); load(); } catch (e) { setMsg(errMsg(e)); } };
  return (
    <div className="c">
      <b>Kategori game</b>
      <div className="fm">
        <input className="in" placeholder="Nama kategori baru" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="bt bs" onClick={() => run(() => api.post('/admin/categories', { name }))}>Tambah</button>
      </div>
      {list.map((c) => (
        <div key={c.id} className="row">
          <span>{c.name}</span>
          <span>
            <button className="ch" onClick={() => { const n = window.prompt('Nama baru', c.name); if (n) run(() => api.put('/admin/categories/' + c.id, { name: n })); }}>Ubah</button>
            <button className="ch" onClick={() => run(() => api.delete('/admin/categories/' + c.id))}>Hapus</button>
          </span>
        </div>
      ))}
      <div className="er mo">{msg}</div>
    </div>
  );
}

const emptyPromo = { code: '', type: 'percent', value: '', maxDiscount: '', minAmount: '', quota: '' };
export function Promos() {
  const [list, setList] = useState([]);
  const [f, setF] = useState(emptyPromo);
  const [msg, setMsg] = useState('');
  const load = useCallback(() => api.get('/admin/promos').then((r) => setList(r.data)), []);
  useEffect(() => { load(); }, [load]);
  const num = (v) => (v === '' ? null : Number(v));
  const run = async (fn, reset) => { setMsg(''); try { await fn(); if (reset) setF(emptyPromo); load(); } catch (e) { setMsg(errMsg(e)); } };
  const add = () => run(() => api.post('/admin/promos', {
    code: f.code, type: f.type, value: Number(f.value), maxDiscount: num(f.maxDiscount), minAmount: Number(f.minAmount || 0), quota: num(f.quota),
  }), true);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="c">
      <b>Promo</b>
      <div className="fm">
        <input className="in" placeholder="KODE" value={f.code} onChange={set('code')} />
        <select className="in" value={f.type} onChange={set('type')}><option value="percent">Persen (%)</option><option value="fixed">Potongan tetap (Rp)</option></select>
        <input className="in" type="number" placeholder="Nilai" value={f.value} onChange={set('value')} />
        <input className="in" type="number" placeholder="Maks. diskon" value={f.maxDiscount} onChange={set('maxDiscount')} />
        <input className="in" type="number" placeholder="Min. belanja" value={f.minAmount} onChange={set('minAmount')} />
        <input className="in" type="number" placeholder="Kuota (kosong = bebas)" value={f.quota} onChange={set('quota')} />
        <button className="bt bs" onClick={add}>Tambah promo</button>
      </div>
      <div className="er mo">{msg}</div>
      {list.map((p) => (
        <div key={p.id} className={'row ' + (p.active ? '' : 'off')}>
          <span><b>{p.code}</b> <small className="mu">{p.type === 'percent' ? p.value + '%' : R(p.value)}{p.maxDiscount ? ' · maks ' + R(p.maxDiscount) : ''}{p.minAmount ? ' · min ' + R(p.minAmount) : ''}{p.quota !== null ? ' · sisa kuota ' + p.quota : ''}</small></span>
          {p.active && <button className="ch" onClick={() => run(() => api.delete('/admin/promos/' + p.id))}>Nonaktifkan</button>}
        </div>
      ))}
    </div>
  );
}

export function Users() {
  const [page, setPage] = useState(1);
  const [res, setRes] = useState({ data: [], meta: null });
  useEffect(() => { api.get('/admin/users', { params: { page, limit: 8 } }).then((r) => setRes(r.data)); }, [page]);
  return (
    <div className="c">
      <b>Pengguna</b>
      <div className="sc">
        <table>
          <thead><tr><th>Nama</th><th>Email</th><th>Role</th><th>Terdaftar</th></tr></thead>
          <tbody>{res.data.map((u) => <tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td>{u.role}</td><td>{fmtDate(u.createdAt)}</td></tr>)}</tbody>
        </table>
      </div>
      <Pager meta={res.meta} onPage={setPage} />
    </div>
  );
}
