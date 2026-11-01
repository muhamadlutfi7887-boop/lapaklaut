import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { errMsg } from '../api.js';
import { useAuth } from '../auth.jsx';

function Form({ title, fields, submit, foot }) {
  const nav = useNavigate();
  const loc = useLocation();
  const [v, setV] = useState({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function go(e) {
    e.preventDefault();
    setErr(''); setBusy(true);
    try { await submit(v); nav(loc.state?.from || '/', { replace: true }); }
    catch (x) { setErr(errMsg(x)); }
    setBusy(false);
  }

  return (
    <form className="c" onSubmit={go} style={{ maxWidth: 400, margin: '30px auto' }}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      {fields.map(([k, label, type]) => (
        <div key={k} style={{ marginBottom: 10 }}>
          <label className="mu">{label}</label>
          <input className="in" type={type} value={v[k] || ''} onChange={(e) => setV({ ...v, [k]: e.target.value })} style={{ marginTop: 4 }} />
        </div>
      ))}
      <div className="er mo">{err}</div>
      <button className="bt" disabled={busy}>{title}</button>
      <p className="mu" style={{ fontSize: 12 }}>{foot}</p>
    </form>
  );
}

export function Login() {
  const { login } = useAuth();
  return (
    <Form title="Masuk" submit={(v) => login(v.email, v.password)}
      fields={[['email', 'Email', 'email'], ['password', 'Kata sandi', 'password']]}
      foot={<>Belum punya akun? <Link to="/register">Daftar</Link>. Demo: user@lapaklaut.id atau admin@lapaklaut.id, sandi 123456.</>} />
  );
}

export function Register() {
  const { register } = useAuth();
  return (
    <Form title="Daftar" submit={register}
      fields={[['name', 'Nama', 'text'], ['email', 'Email', 'email'], ['password', 'Kata sandi (min. 6 karakter)', 'password']]}
      foot={<>Sudah punya akun? <Link to="/login">Masuk</Link></>} />
  );
}
