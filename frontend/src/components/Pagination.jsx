export default function Pagination({ page, totalPages, total, perPage, onPage }) {
  if (total === 0) return null;

  const pages = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  for (let i = start; i <= end; i++) pages.push(i);

  const from = (page - 1) * perPage + 1;
  const to = Math.min(total, page * perPage);

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-ink px-6 py-4 sm:flex-row">
      <div className="font-mono text-[12px] text-muted">
        Menampilkan <span className="font-bold text-ink">{from}–{to}</span> dari{' '}
        <span className="font-bold text-ink">{total}</span> personel
      </div>
      <div className="flex items-center gap-1">
        <button
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="rounded-pill border border-ink px-3 py-1 font-mono text-xs text-ink transition hover:bg-ink hover:text-bone disabled:opacity-40 disabled:hover:bg-bone disabled:hover:text-ink"
        >
          ←
        </button>
        {pages.map((p) => (
          <button
            key={p}
            onClick={() => onPage(p)}
            className={`rounded-pill px-3 py-1 font-mono text-xs font-bold transition ${
              p === page
                ? 'bg-ink text-bone' // halaman aktif: fill solid (bukan Hi-Vis — teks kecil butuh kontras)
                : 'border border-ink text-ink hover:bg-ink hover:text-bone'
            }`}
          >
            {p}
          </button>
        ))}
        <button
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          className="rounded-pill border border-ink px-3 py-1 font-mono text-xs text-ink transition hover:bg-ink hover:text-bone disabled:opacity-40 disabled:hover:bg-bone disabled:hover:text-ink"
        >
          →
        </button>
      </div>
    </div>
  );
}
