export default function StatCards({ stats, fieldsCount }) {
  const cards = [
    { label: 'Total Karyawan', value: stats?.total ?? '—' },
    { label: 'Karyawan Baru Bulan Ini', value: stats?.new_this_month ?? '—' },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <div key={card.label} className="rounded-2xl border border-line bg-cream p-6">
          <div className="font-display text-4xl font-bold tracking-tight text-coal">{card.value}</div>
          <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-muted">{card.label}</div>
        </div>
      ))}
      <div className="hidden rounded-2xl border border-line bg-cream p-6 lg:block">
        <div className="font-display text-4xl font-bold tracking-tight text-sage">{fieldsCount ?? 0}</div>
        <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-muted">Kolom Biodata</div>
      </div>
    </div>
  );
}