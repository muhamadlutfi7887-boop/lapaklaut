export class AppError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}
export const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
export const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');
export const page = (q) => {
  const pg = Math.max(1, parseInt(q.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(q.limit) || 10));
  return { page: pg, limit, skip: (pg - 1) * limit };
};
export const meta = (total, p) => ({ total, page: p.page, limit: p.limit, totalPages: Math.max(1, Math.ceil(total / p.limit)) });
