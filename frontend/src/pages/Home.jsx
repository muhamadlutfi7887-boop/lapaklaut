import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, R } from '../api.js';
import { Cover, Pager } from '../ui.jsx';

const BANNERS = [
  ['Top Up Instan 24 Jam', 'Diamond dan UC masuk dalam hitungan detik'],
  ['Hemat dengan kode LAUT10', 'Diskon 10% maksimal Rp10.000 untuk semua game'],
  ['Bayar Sesuai Selera', 'QRIS, e-wallet, virtual account, dan minimarket'],
];
const left = () => { const e = new Date(); e.setHours(23, 59, 59, 0); return Math.max(0, Math.floor((e - Date.now()) / 1000)); };

function Countdown() {
  const [s, setS] = useState(left());
  useEffect(() => { const t = setInterval(() => setS(left()), 1000); return () => clearInterval(t); }, []);
  return <b>{[s / 3600, (s / 60) % 60, s % 60].map((n) => String(Math.floor(n)).padStart(2, '0')).join(':')}</b>;
}

export default function Home() {
  const [sp, setSp] = useSearchParams();
  const search = sp.get('search') || '', category = sp.get('category') || '', page = Number(sp.get('page') || 1);
  const [cats, setCats] = useState([]);
  const [res, setRes] = useState({ data: [], meta: null });
  const [slide, setSlide] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => { api.get('/categories').then((r) => setCats(r.data)); }, []);
  useEffect(() => {
    setLoading(true);
    api.get('/games', { params: { search, category, page, limit: 8 } }).then((r) => setRes(r.data)).finally(() => setLoading(false));
  }, [search, category, page]);
  useEffect(() => { const t = setInterval(() => setSlide((x) => (x + 1) % BANNERS.length), 3500); return () => clearInterval(t); }, []);

  const set = (k, v) => {
    const n = new URLSearchParams(sp);
    v ? n.set(k, v) : n.delete(k);
    if (k !== 'page') n.delete('page');
    setSp(n);
  };

  return (
    <>
      <div className="hero">
        {BANNERS.map((b, i) => (
          <div key={i} className={'sl ' + (i === slide ? 'on' : '')}><h2>{b[0]}</h2><p>{b[1]}</p></div>
        ))}
      </div>
      <div className="tr">
        <div><b>Proses Instan</b><span className="mu">Rata-rata kurang dari 1 menit</span></div>
        <div><b>Aman Terpercaya</b><span className="mu">Transaksi tercatat dan terverifikasi</span></div>
        <div><b>Harga Terbaik</b><span className="mu">Promo setiap hari</span></div>
        <div><b>Bantuan 24/7</b><span className="mu">Tim siap membantu</span></div>
      </div>
      <div className="fl"><b>FLASH SALE · pakai kode LAUT10 atau NEWUSER</b><Countdown /></div>

      <h3>Pilih Game{search && ` · hasil untuk "${search}"`}</h3>
      <div className="chs">
        {['', ...cats.map((c) => c.name)].map((c) => (
          <button key={c} className={'ch ' + (c === category ? 'on' : '')} onClick={() => set('category', c)}>{c || 'Semua'}</button>
        ))}
      </div>
      <div className="gr">
        {res.data.map((g) => (
          <Link key={g.id} to={`/game/${g.slug}`} className="gc" style={{ color: 'inherit', textDecoration: 'none' }}>
            <Cover g={g} />
            <div>
              <b>{g.name}</b>
              <span className="mu">Top up {g.currency}</span>
              <span className="pc">{g.minPrice ? 'Mulai ' + R(g.minPrice) : 'Belum tersedia'}</span>
            </div>
          </Link>
        ))}
        {!loading && !res.data.length && <div className="c ctr" style={{ gridColumn: '1/-1' }}>Game tidak ditemukan. Coba kata kunci atau kategori lain.</div>}
      </div>
      <Pager meta={res.meta} onPage={(p) => set('page', p)} />
    </>
  );
}
