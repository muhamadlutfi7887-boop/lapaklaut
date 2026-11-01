import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api.js';

const Ctx = createContext();
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('token')) { setReady(true); return; }
    api.get('/auth/me').then((r) => setUser(r.data)).catch(() => localStorage.removeItem('token')).finally(() => setReady(true));
  }, []);

  const save = ({ token, user }) => { localStorage.setItem('token', token); setUser(user); };
  const login = async (email, password) => save((await api.post('/auth/login', { email, password })).data);
  const register = async (body) => save((await api.post('/auth/register', body)).data);
  const logout = () => { localStorage.removeItem('token'); setUser(null); };

  return <Ctx.Provider value={{ user, ready, login, register, logout }}>{children}</Ctx.Provider>;
}
