// Kartu statistik — pengecualian resmi PRD (Section 2): 3 kartu confetti dengan
// 3 warna aksen berbeda. Radius 6px, padding 17px, tanpa shadow; teks gelap di
// kartu terang (pink/matcha), teks terang di kartu gelap (magenta).
export default function StatCards({ stats, fieldsCount }) {
  const cards = [
    { label: 'Total Personel', value: stats?.total ?? '—', cls: 'bg-bubblegum' },
    { label: 'Personel Baru Bulan Ini', value: stats?.new_this_month ?? '—', cls: 'bg-matcha' },
  ];

  const numCls = 'relative font-display text-[48px] leading-[0.9] tracking-tight';
  const lblCls = 'relative mt-2 font-mono text-[12px] font-semibold uppercase tracking-[0.14em]';

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <div key={card.label} className={`rounded-card border-2 border-pure p-[17px] ${card.cls}`}>
          <div className={`${numCls} text-ink`}>{card.value}</div>
          <div className={`${lblCls} text-ink/70`}>{card.label}</div>
        </div>
      ))}
      <div className="hidden rounded-card border-2 border-pure p-[17px] bg-magenta lg:block">
        <div className={`${numCls} text-bone`}>{fieldsCount ?? 0}</div>
        <div className={`${lblCls} text-bone/80`}>Kolom Biodata</div>
      </div>
    </div>
  );
}
