import { useState } from 'react';
import Modal from './Modal';
import { api } from '../api';

export default function ExportModal({ fields, initialFilters = {}, onClose }) {
  const [selected, setSelected] = useState(() => ({
    nama: true,
    ...Object.fromEntries(fields.map((f) => [String(f.id), true])),
  }));
  const [error, setError] = useState('');

  // Filter baris (khusus kolom dropdown): { idKolom: nilai }
  const dropdownFields = fields.filter((f) => f.field_type === 'dropdown');
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
      <p className="mb-4 text-sm leading-relaxed text-coal/80">
        Centang kolom yang ingin disertakan dalam file Excel. File otomatis ter-download dalam format tabel
        rapi (header tebal, border, lebar kolom auto-fit).
      </p>
      <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-line bg-white p-4">
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={!!selected.nama}
            onChange={() => toggle('nama')}
            className="h-4 w-4 accent-ink"
          />
          <span className="text-sm font-semibold text-coal">Nama Lengkap</span>
        </label>
        {fields.map((f) => (
          <label key={f.id} className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={!!selected[String(f.id)]}
              onChange={() => toggle(String(f.id))}
              className="h-4 w-4 accent-ink"
            />
            <span className="text-sm text-coal">{f.label}</span>
          </label>
        ))}
      </div>

      {dropdownFields.length > 0 && (
        <div className="mt-4">
          <div className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">
            Filter Baris (opsional)
          </div>
          <p className="mb-2 text-xs leading-relaxed text-coal/70">
            Hanya untuk kolom bertipe Dropdown. Personel yang tidak cocok dengan filter tidak ikut
            ter-export.
          </p>
          <div className="space-y-2 rounded-xl border border-line bg-white p-3">
            {dropdownFields.map((f) => (
              <div key={f.id} className="flex flex-wrap items-center gap-2">
                <span className="w-40 shrink-0 truncate text-xs font-semibold text-coal" title={f.label}>
                  {f.label}
                </span>
                <select
                  value={filters[String(f.id)] ?? ''}
                  onChange={(e) => setFilter(String(f.id), e.target.value)}
                  className="min-w-0 flex-1 cursor-pointer rounded-lg border border-line bg-white px-3 py-1.5 text-sm text-coal transition focus:border-ink focus:outline-none"
                >
                  <option value="">Semua</option>
                  {(f.options || []).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            {Object.keys(filters).length > 0 && (
              <div className="flex justify-end">
                <button
                  onClick={() => setFilters({})}
                  className="rounded-full border border-clay/40 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-clay transition hover:bg-clay/10"
                >
                  Reset Filter
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {error && <div className="mt-3 rounded-lg bg-clay/10 px-3 py-2 text-sm text-clay">{error}</div>}

      <div className="mt-6 flex justify-end gap-3">
        <button
          onClick={onClose}
          className="rounded-full border border-line px-5 py-2 text-xs font-semibold uppercase tracking-wider text-coal transition hover:bg-line/50"
        >
          Batal
        </button>
        <button
          onClick={doExport}
          className="rounded-full bg-sage px-5 py-2 text-xs font-semibold uppercase tracking-wider text-cream transition hover:bg-sage/90"
        >
          Export .xlsx
        </button>
      </div>
    </Modal>
  );
}