export default function Pagination({ page, totalPages, total, perPage, onPage }) {
  if (total === 0) return null;

  const pages = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  for (let i = start; i <= end; i++) pages.push(i);

  const from = (page - 1) * perPage + 1;
  const to = Math.min(total, page * perPage);

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-line px-6 py-4 sm:flex-row">
      <div className="text-xs text-muted">
        Menampilkan <span className="font-semibold text-coal">{from}–{to}</span> dari{' '}
        <span className="font-semibold text-coal">{total}</span> karyawan
      </div>
      <div className="flex items-center gap-1">
        <button
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="rounded-full border border-line px-3 py-1 text-xs text-coal transition hover:bg-line/40 disabled:opacity-40"
        >
          ←
        </button>
        {pages.map((p) => (
          <button
            key={p}
            onClick={() => onPage(p)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              p === page ? 'bg-ink text-cream' : 'border border-line text-coal hover:bg-line/40'
            }`}
          >
            {p}
          </button>
        ))}
        <button
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          className="rounded-full border border-line px-3 py-1 text-xs text-coal transition hover:bg-line/40 disabled:opacity-40"
        >
          →
        </button>
      </div>
    </div>
  );
}