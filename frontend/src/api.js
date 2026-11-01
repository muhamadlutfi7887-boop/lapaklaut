import axios from 'axios';

export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api' });
api.interceptors.request.use((c) => {
  const t = localStorage.getItem('token');
  if (t) c.headers.Authorization = 'Bearer ' + t;
  return c;
});

export const R = (n) => 'Rp' + Math.round(n || 0).toLocaleString('id-ID');
export const ST = {
  pending: ['Menunggu Bayar', 'wn'], paid: ['Dibayar', 'pr'], processing: ['Diproses', 'pr'],
  success: ['Berhasil', 'ok'], failed: ['Gagal', 'er'], expired: ['Kedaluwarsa', 'mu'],
};
export const ini = (n) => n.split(' ').map((w) => w[0]).join('').slice(0, 3);
export const fmtDate = (d) => new Date(d).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });

export function errMsg(e) {
  const d = e.response?.data;
  if (!d) return e.message;
  const det = d.errors ? '\n' + Object.values(d.errors).flat().join('\n') : '';
  return d.message + det;
}
