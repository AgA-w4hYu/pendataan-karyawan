import { useState } from 'react';
import Modal from './Modal';
import { api } from '../api';

export default function ExportModal({ fields, onClose }) {
  const [selected, setSelected] = useState(() => ({
    nama: true,
    ...Object.fromEntries(fields.map((f) => [String(f.id), true])),
  }));
  const [error, setError] = useState('');

  const toggle = (key) => setSelected((prev) => ({ ...prev, [key]: !prev[key] }));

  const doExport = () => {
    const keys = Object.keys(selected).filter((k) => selected[k]);
    if (keys.length === 0) {
      setError('Pilih minimal satu kolom untuk di-export.');
      return;
    }
    window.location.href = api.exportUrl(keys);
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