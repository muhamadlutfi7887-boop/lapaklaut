import { useCallback, useEffect, useState } from 'react';
import { api, errMsg, fmtDate, R, ST } from '../api.js';
import { Badge, Pager } from '../ui.jsx';
import { Categories, Promos, ReportDownload, Users } from './AdminExtra.jsx';

function Dashboard() {
  const [d, setD] = useState(null);
  useEffect(() => { api.get('/admin/report').then((r) => setD(r.data)); }, []);
  if (!d) return <div className="c ctr">Memuat…</div>;
  const mx = Math.max(...d.daily.map((x) => x.revenue), 1);
  return (
    <>
      <div className="sg">
        <div className="c"><span className="mu">Omzet</span><b>{R(d.revenue)}</b></div>
        <div className="c"><span className="mu">Laba</span><b>{R(d.profit)}</b></div>
        <div className="c"><span className="mu">Total transaksi</span><b>{d.totalOrders}</b></div>
        <div className="c"><span className="mu">Tingkat sukses</span><b>{d.successRate}%</b></div>
      </div>
      <div className="dg" style={{ gridTemplateColumns: '2fr 1fr', marginTop: 12 }}>
        <div className="c">
          <b>Omzet 7 hari terakhir</b>
          <div className="bars">{d.daily.map((x) => <div key={x.date}><i style={{ height: (x.revenue / mx) * 90 + 2 }} />{x.date.slice(5)}</div>)}</div>
        </div>
        <div className="c">
          <b>Game terlaris</b>
          {d.topGames.map((t) => <div key={t.name} className="row"><span>{t.name}</span><b>{t.sold}</b></div>)}
          <b style={{ display: 'block', marginTop: 12 }}>Stok rendah</b>
          {d.lowStock.length ? d.lowStock.map((s) => <div key={s.id} className="row"><span>{s.game.name} · {s.label}</span><b>{s.stock}</b></div>) : <span className="mu">Semua stok aman</span>}
        </div>
      </div>
      <ReportDownload />
    </>
  );
}

function Orders() {
  const [q, setQ] = useState({ search: '', status: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [res, setRes] = useState({ data: [], meta: null });
  useEffect(() => {
    const t = setTimeout(() => api.get('/admin/orders', { params: { ...q, page, limit: 8 } }).then((r) => setRes(r.data)), 250);
    return () => clearTimeout(t);
  }, [q, page]);
  const set = (k, v) => { setQ({ ...q, [k]: v }); setPage(1); };
  return (
    <div className="c">
      <div className="fm">
        <input className="in" placeholder="Cari invoice, game, target…" value={q.search} onChange={(e) => set('search', e.target.value)} />
        <select className="in" value={q.status} onChange={(e) => set('status', e.target.value)}>
          <option value="">Semua status</option>
          {Object.entries(ST).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}
        </select>
        <input className="in" type="date" value={q.from} onChange={(e) => set('from', e.target.value)} />
        <input className="in" type="date" value={q.to} onChange={(e) => set('to', e.target.value)} />
      </div>
      <div className="sc">
        <table>
          <thead><tr><th>Invoice</th><th>Item</th><th>Akun</th><th>Pembeli</th><th>Total</th><th>Status</th><th>Tanggal</th></tr></thead>
          <tbody>
            {res.data.map((o) => (
              <tr key={o.id}><td>{o.invoice}</td><td>{o.itemLabel}</td><td>{o.target}</td><td>{o.user.email}</td><td>{R(o.total)}</td><td><Badge s={o.status} /></td><td>{fmtDate(o.createdAt)}</td></tr>
            ))}
            {!res.data.length && <tr><td colSpan="7">Tidak ada data</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager meta={res.meta} onPage={setPage} />
    </div>
  );
}

function Catalog() {
  const [games, setGames] = useState([]);
  const [cats, setCats] = useState([]);
  const [msg, setMsg] = useState('');
  const [gf, setGf] = useState({ name: '', slug: '', currency: '', categoryId: '', cover: '#0a6ea8' });
  const [pf, setPf] = useState({});
  const [af, setAf] = useState('');
  const load = useCallback(() => {
    api.get('/admin/games').then((r) => setGames(r.data));
    api.get('/categories').then((r) => setCats(r.data));
  }, []);
  useEffect(() => { load(); }, [load]);

  const run = async (fn, ok) => { setMsg(''); try { await fn(); setMsg(ok); load(); } catch (e) { setMsg(errMsg(e)); } };
  const addGame = () => run(() => api.post('/admin/games', { ...gf, categoryId: Number(gf.categoryId) }), 'Game ditambahkan');
  const addProd = (gameId) => {
    const p = pf[gameId] || {};
    return run(() => api.post('/admin/products', { gameId, label: p.label, price: Number(p.price), costPrice: Number(p.cost || 0) }), 'Produk ditambahkan');
  };
  const setP = (id, k, v) => setPf({ ...pf, [id]: { ...pf[id], [k]: v } });

  return (
    <>
      <div className="c">
        <b>Tambah game</b>
        <div className="fm">
          <input className="in" placeholder="Nama game" value={gf.name} onChange={(e) => setGf({ ...gf, name: e.target.value })} />
          <input className="in" placeholder="slug-game" value={gf.slug} onChange={(e) => setGf({ ...gf, slug: e.target.value })} />
          <input className="in" placeholder="Mata uang (Diamond)" value={gf.currency} onChange={(e) => setGf({ ...gf, currency: e.target.value })} />
          <select className="in" value={gf.categoryId} onChange={(e) => setGf({ ...gf, categoryId: e.target.value })}>
            <option value="">Kategori</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input className="in" type="color" value={gf.cover} onChange={(e) => setGf({ ...gf, cover: e.target.value })} />
          <button className="bt" onClick={addGame}>Simpan game</button>
        </div>
        <div className="er mo">{msg}</div>
      </div>
      <div className="tb">
        <select className="in" style={{ width: 200 }} value={af} onChange={(e) => setAf(e.target.value)}>
          <option value="">Semua status</option><option value="true">Aktif</option><option value="false">Nonaktif</option>
        </select>
      </div>
      {games.filter((g) => af === '' || String(g.active) === af).map((g) => (
        <div key={g.id} className={'c ' + (g.active ? '' : 'off')} style={{ marginTop: 10 }}>
          <div className="row">
            <b>{g.name} <small className="mu">· {g.category.name}</small></b>
            {g.active && <button className="ch" onClick={() => run(() => api.delete('/admin/games/' + g.id), 'Game dinonaktifkan')}>Nonaktifkan</button>}
          </div>
          {g.products.map((p) => (
            <div key={p.id} className={'row ' + (p.active ? '' : 'off')}>
              <span>{p.label}</span>
              <span>{R(p.price)} <small className="mu">modal {R(p.costPrice)}{p.stock !== null && ` · stok ${p.stock}`}</small>
                {p.active && <button className="ch" onClick={() => run(() => api.delete('/admin/products/' + p.id), 'Produk dinonaktifkan')}>Hapus</button>}</span>
            </div>
          ))}
          <div className="fm">
            <input className="in" placeholder="Label (86 Diamond)" value={pf[g.id]?.label || ''} onChange={(e) => setP(g.id, 'label', e.target.value)} />
            <input className="in" placeholder="Harga jual" type="number" value={pf[g.id]?.price || ''} onChange={(e) => setP(g.id, 'price', e.target.value)} />
            <input className="in" placeholder="Harga modal" type="number" value={pf[g.id]?.cost || ''} onChange={(e) => setP(g.id, 'cost', e.target.value)} />
            <button className="bt bs" onClick={() => addProd(g.id)}>Tambah nominal</button>
          </div>
        </div>
      ))}
    </>
  );
}

export default function Admin() {
  const [tab, setTab] = useState('dash');
  const tabs = [['dash', 'Dashboard'], ['orders', 'Transaksi'], ['catalog', 'Katalog'], ['cats', 'Kategori'], ['promos', 'Promo'], ['users', 'User']];
  return (
    <>
      <h3>Panel Admin</h3>
      <div className="tb">{tabs.map(([k, l]) => <button key={k} className={'ch ' + (tab === k ? 'on' : '')} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'dash' && <Dashboard />}
      {tab === 'orders' && <Orders />}
      {tab === 'catalog' && <Catalog />}
      {tab === 'cats' && <Categories />}
      {tab === 'promos' && <Promos />}
      {tab === 'users' && <Users />}
    </>
  );
}
