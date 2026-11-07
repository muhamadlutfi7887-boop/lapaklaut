# LapakLaut – Marketplace Top Up Game
<img width="1075" height="763" alt="image" src="https://github.com/user-attachments/assets/f1b2a126-5226-4a8a-986f-1f6abc9a13e5" />

Final Project Full Stack Web Development. Tema: Sistem Transaksi Penjualan (marketplace top up game).

| Bagian | Isi |
|---|---|
| `backend/` | API Node.js, Express, Prisma, JWT, Zod, cache Redis, export Excel/PDF |
| `frontend/` | React, Vite, React Router, Axios |
| `fulfillment-service/` | Microservice top up (meniru provider), terhubung lewat HTTP dan callback |
| `docs/` | Postman collection, ERD (`ERD.md`, `erd.dbml`) |
| `docker-compose.yml` | Menjalankan seluruh stack |

## Menjalankan

### Opsi A: Docker (semua service sekaligus)
```bash
docker compose up --build
```
Web: http://localhost:8080 · API: http://localhost:4000/api. Run pertama mengisi data contoh. Setelah itu ubah `SEED_ON_START` di `docker-compose.yml` menjadi `"false"` supaya data tidak direset.

### Opsi B: manual
```bash
# 1. Backend (port 4000)
cd backend
cp .env.example .env
npm install
npx prisma db push      # membuat tabel
npm run seed            # data contoh: game, promo, user, transaksi
npm run dev

# 2. Frontend (port 5173), terminal lain
cd frontend
npm install
npm run dev

# 3. Opsional: microservice top up (port 5000)
cd fulfillment-service
npm install
npm start
# lalu isi di backend/.env: FULFILLMENT_URL="http://localhost:5000" dan SERVICE_KEY="dev-service-key"
# opsional cache Redis: REDIS_URL="redis://localhost:6379"
```
Tanpa `FULFILLMENT_URL`, top up disimulasikan di dalam API. Tanpa `REDIS_URL`, cache memakai memori proses.

Akun demo (sandi `123456`): `admin@lapaklaut.id` (admin) dan `user@lapaklaut.id` (user).
Ganti `JWT_SECRET` dan `WEBHOOK_TOKEN` sebelum deploy.

## Fitur
- Register, login, JWT, role-based authorization (admin / user)
- Katalog game: search, filter kategori, pagination (`page`, `limit`)
- Checkout top up: validasi ID akun per game, kode promo, 5 metode bayar
- Stok dan kuota promo dikurangi atomik di DB transaction (anti oversell), dikembalikan jika gagal atau kedaluwarsa
- Status pesanan: `pending → paid → processing → success` (plus `failed`, `expired`)
- Webhook pembayaran dan callback fulfillment idempotent; pesanan kedaluwarsa otomatis setelah 15 menit (scheduler)
- Admin panel: dashboard (omzet, laba, game terlaris, stok rendah), transaksi (search, filter status dan tanggal, pagination), CRUD game, produk, kategori, promo, daftar user
- Filter status aktif/nonaktif untuk game, produk, dan promo; soft delete supaya riwayat transaksi utuh

### Fitur tambahan (bonus)
| Bonus | Implementasi |
|---|---|
| Responsive design | CSS mobile-first untuk katalog, checkout, dan admin (breakpoint 760px) |
| Dockerize | `docker-compose.yml` berisi api, web (nginx), redis, dan fulfillment |
| Download laporan | `GET /api/admin/report/export?format=xlsx\|pdf&from=&to=` (ExcelJS, PDFKit), tombol di dashboard admin |
| Caching | Redis (atau memori). Kategori, katalog game, dan laporan di-cache; otomatis dihapus saat data berubah. Header `X-Cache: HIT/MISS` |
| Microservice | `fulfillment-service` terpisah: API utama `POST /topup` (202), lalu service memanggil `POST /api/fulfillment/callback` |

## Endpoint

| Method | Path | Akses |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login` | publik |
| GET | `/api/auth/me` | login |
| GET | `/api/categories`, `/api/payment-methods` | publik |
| GET | `/api/games?search=&category=&page=&limit=` | publik |
| GET | `/api/games/:slug` | publik |
| GET | `/api/promos/check?code=&amount=` | publik |
| POST | `/api/payments/webhook` (header `x-callback-token`) | payment gateway |
| POST | `/api/fulfillment/callback` (header `x-callback-token`) | fulfillment service |
| POST | `/api/orders` | login |
| GET | `/api/orders/me`, `/api/orders/:id` | login (pemilik / admin) |
| POST | `/api/orders/:id/simulate-pay` | login (pemilik) |
| GET | `/api/admin/report`, `/api/admin/report/export`, `/api/admin/orders`, `/api/admin/users` | admin |
| GET/POST/PUT/DELETE | `/api/admin/categories`, `/games`, `/products`, `/promos` (GET: `?active=true\|false`) | admin |

Dokumentasi lengkap dengan contoh payload dan response: `docs/LapakLaut.postman_collection.json` (import ke Postman, jalankan folder Auth lebih dulu).
Diagram dan penjelasan relasi data: `docs/ERD.md`.

Contoh checkout:
```json
POST /api/orders
{ "productId": 1, "target": ["123456789", "1234"], "method": "QRIS", "promoCode": "LAUT10" }
```
Untuk menguji status `failed`: akun tujuan berakhiran `000` sengaja ditolak provider.

## Deployment
- **Docker:** `docker compose up --build` di server mana pun yang punya Docker. Ganti `JWT_SECRET`, `WEBHOOK_TOKEN`, `SERVICE_KEY`, dan `VITE_API_URL` (alamat publik API) di `docker-compose.yml`.
- **Frontend (Vercel / Netlify):** root `frontend`, build `npm run build`, output `dist`, env `VITE_API_URL=https://alamat-api-kamu/api`. `vercel.json` sudah menangani routing React Router.
- **Backend (Railway / Render / VPS):** root `backend`, start `sh docker-entrypoint.sh` atau `npx prisma db push && node src/server.js`. Set env dari `.env.example`, dan `CORS_ORIGIN` ke alamat frontend.
- **Database produksi:** ubah `provider` di `backend/prisma/schema.prisma` ke `postgresql` dan isi `DATABASE_URL`. SQLite di hosting dengan disk sementara akan hilang saat restart.

## Catatan
- JWT dipakai sebagai padanan Sanctum (guideline menyebut Sanctum untuk Laravel).
- Pembayaran dan provider top up disimulasikan. Untuk produksi, ganti `simulate-pay` dengan Midtrans sandbox dan hubungkan fulfillment service ke provider asli.
- Cache Redis memakai `KEYS` untuk invalidasi: cukup untuk skala proyek, ganti ke `SCAN` bila datanya besar.
# lapaklaut
