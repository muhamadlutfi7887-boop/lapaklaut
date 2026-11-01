import { useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Home from './pages/Home.jsx';
import Game from './pages/Game.jsx';
import { Login, Register } from './pages/Auth.jsx';
import { OrderDetail, OrderList } from './pages/Orders.jsx';
import Admin from './pages/Admin.jsx';

function Header() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  return (
    <header>
      <div className="hr w">
        <Link to="/" className="lg"><u>L</u>Lapak<span>Laut</span></Link>
        <input id="q" placeholder="Cari game favoritmu…" value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && nav('/?search=' + encodeURIComponent(q))} />
        <nav>
          <button onClick={() => nav('/')}>Beranda</button>
          {user && <button onClick={() => nav('/orders')}>Riwayat</button>}
          {user?.role === 'admin' && <button onClick={() => nav('/admin')}>Admin</button>}
          {user ? <button onClick={() => { logout(); nav('/'); }}>Keluar</button> : <button onClick={() => nav('/login')}>Masuk</button>}
        </nav>
      </div>
    </header>
  );
}

function Private({ children, admin }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return null;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  if (admin && user.role !== 'admin') return <div className="c ctr">Halaman khusus admin.</div>;
  return children;
}

export default function App() {
  return (
    <>
      <Header />
      <main className="w">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/game/:slug" element={<Game />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/orders" element={<Private><OrderList /></Private>} />
          <Route path="/orders/:id" element={<Private><OrderDetail /></Private>} />
          <Route path="/admin" element={<Private admin><Admin /></Private>} />
          <Route path="*" element={<div className="c ctr">Halaman tidak ditemukan.</div>} />
        </Routes>
      </main>
      <footer>© 2026 LapakLaut.</footer>
    </>
  );
}
