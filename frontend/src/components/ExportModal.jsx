import { useState } from 'react';
import Modal from './Modal';
import { api } from '../api';

export default function ExportModal({ fields, initialFilters = {}, onClose }) {
  const [selected, setSelected] = useState(() => ({
    nama: true,
    ...Object.fromEntries(fields.map((f) => [String(f.id), true])),
  }));
  const [error, setError] = useState('');

  // Filter baris (khusus kolom dropdown / dropdown berurutan): { idKolom: nilai }
  const dropdownFields = fields.filter((f) => f.field_type === 'dropdown' || f.field_type === 'ordered_select');
  const [filters, setFilters] = useState(() =>
    Object.fromEntries(Object.entries(initialFilters).filter(([, v]) => v !== '' && v != null)),
  );
  const setFilter = (key, value) => {
    setFilters((prev) => {
      const next = { ...prev };
      if (value === '') delete next[key];
      else next[key] = value;
      return next;
    });
  };

  const toggle = (key) => setSelected((prev) => ({ ...prev, [key]: !prev[key] }));

  const doExport = () => {
    const keys = Object.keys(selected).filter((k) => selected[k]);
    if (keys.length === 0) {
      setError('Pilih minimal satu kolom untuk di-export.');
      return;
    }
    window.location.href = api.exportUrl(keys, filters);
  };

  return (
    <Modal title="Export ke Excel" onClose={onClose}>
      <p className="mb-4 text-sm leading-relaxed text-ink/80">
        Centang kolom yang ingin disertakan dalam file Excel. File otomatis ter-download dalam format tabel
        rapi (header tebal, border, lebar kolom auto-fit).
      </p>
      <div className="max-h-72 space-y-2 overflow-y-auto rounded-card border border-ink bg-bone p-4">
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={!!selected.nama}
            onChange={() => toggle('nama')}              className="h-4 w-4 accent-magenta"
          />
          <span className="text-sm font-semibold text-ink">Nama Lengkap</span>
        </label>
        {fields.map((f) => (
          <label key={f.id} className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={!!selected[String(f.id)]}
              onChange={() => toggle(String(f.id))}
              className="h-4 w-4 accent-magenta"
            />
            <span className="text-sm text-ink">{f.label}</span>
          </label>
        ))}
      </div>

      {dropdownFields.length > 0 && (
        <div className="mt-4">
          <div className="mb-1 block font-mono text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">
            Filter Baris (opsional)
          </div>
          <p className="mb-2 text-xs leading-relaxed text-ink/70">
            Hanya untuk kolom bertipe Dropdown atau Dropdown Berurutan. Personel yang tidak cocok dengan
            filter tidak ikut ter-export.
          </p>
          <div className="space-y-2 rounded-card border border-ink bg-lilacshadow/10 p-3">
            {dropdownFields.map((f) => (
              <div key={f.id} className="flex flex-wrap items-center gap-2">
                <span className="w-40 shrink-0 truncate text-xs font-semibold text-ink" title={f.label}>
                  {f.label}
                </span>
                <select
                  value={filters[String(f.id)] ?? ''}
                  onChange={(e) => setFilter(String(f.id), e.target.value)}
                  className="min-w-0 flex-1 cursor-pointer rounded-card border border-ink bg-bone px-3 py-1.5 font-mono text-[12px] uppercase tracking-wide text-ink transition focus:border-magenta focus:outline-none"
                >
                  <option value="">Semua</option>
                  {(f.options || []).map((opt) =>
                    f.field_type === 'ordered_select' ? (
                      // Urutan mengikuti hierarki yang diatur admin
                      <option key={opt.id} value={String(opt.id)}>
                        {opt.label}
                      </option>
                    ) : (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ),
                  )}
                </select>
              </div>
            ))}
            {Object.keys(filters).length > 0 && (
              <div className="flex justify-end">
                <button
                  onClick={() => setFilters({})}
                  className="rounded-pill border border-firecracker px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-firecracker transition hover:bg-firecracker hover:text-bone"
                >
                  Reset Filter
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {error && <div className="mt-3 rounded-card border border-firecracker bg-firecracker/10 px-3 py-2 text-sm text-firecracker">{error}</div>}

      <div className="mt-6 flex justify-end gap-3">
        <button
          onClick={onClose}
          className="rounded-pill border border-ink bg-bone px-5 py-2 font-grotesk text-xs font-bold uppercase tracking-[0.05em] text-ink transition hover:bg-ink hover:text-bone"
        >
          Batal
        </button>
        <button
          onClick={doExport}
          className="rounded-pill bg-magenta px-5 py-2 font-grotesk text-xs font-bold uppercase tracking-[0.05em] text-bone transition hover:bg-rosedark"
        >
          Export .xlsx
        </button>
      </div>
    </Modal>
  );
}