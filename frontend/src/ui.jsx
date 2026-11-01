import { ST, ini } from './api.js';

export const Badge = ({ s }) => <span className={'b ' + ST[s][1]}>{ST[s][0]}</span>;

export const Cover = ({ g }) => {
  const isImage = g.cover && (g.cover.startsWith('http://') || g.cover.startsWith('https://') || g.cover.startsWith('/'));
  
  return (
    <div className="cv" style={{ background: isImage ? `url(${g.cover}) center/cover no-repeat` : g.cover }}>
      {!isImage && (
        <>
          <em>{g.category}</em>
          <b>{ini(g.name)}</b>
        </>
      )}
    </div>
  );
};

export function Pager({ meta, onPage }) {
  if (!meta) return null;
  return (
    <div className="row" style={{ marginTop: 10 }}>
      <span className="mu">Halaman {meta.page} dari {meta.totalPages} · {meta.total} data</span>
      <span>
        <button className="ch" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>‹ Prev</button>
        <button className="ch" disabled={meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)}>Next ›</button>
      </span>
    </div>
  );
}