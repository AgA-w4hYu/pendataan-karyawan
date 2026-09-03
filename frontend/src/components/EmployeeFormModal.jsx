import { useEffect, useRef, useState } from 'react';
import Modal from './Modal';

// Dropdown yang bisa diketik untuk mencari pilihan — berguna saat opsi sudah banyak.
function SearchableSelect({ options = [], value = '', onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [open]);

  const q = query.trim().toLowerCase();
  const filtered = q ? options.filter((opt) => opt.toLowerCase().includes(q)) : options;

  const openBox = () => {
    setQuery('');
    setOpen(true);
  };
  const choose = (opt) => {
    onChange(opt);
    setOpen(false);
    setQuery('');
  };
  const clear = () => {
    onChange('');
    setOpen(false);
    setQuery('');
  };

  const base =
    'w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-coal transition focus:border-ink focus:outline-none';

  return (
    <div className="relative" ref={wrapRef}>
      <input
        type="text"
        value={open ? query : value}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (!open) openBox();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setOpen(false);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            if (open) {
              if (filtered.length > 0) choose(filtered[0]);
            } else {
              setOpen(true);
            }
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
          }
        }}
        placeholder={open ? 'Ketik untuk mencari pilihan…' : value ? '' : 'Ketik / pilih…'}
        className={`${base} pr-9`}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => (open ? setOpen(false) : openBox())}
        className="absolute right-1 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-[10px] leading-none text-muted transition hover:text-coal"
        aria-label={open ? 'Tutup daftar pilihan' : 'Buka daftar pilihan'}
      >
        {open ? '▲' : '▼'}
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-44 overflow-y-auto rounded-lg border border-line bg-white py-1 shadow-lg">
          {value !== '' && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                clear();
              }}
              className="block w-full px-3 py-1.5 text-left text-xs font-semibold text-clay transition hover:bg-clay/10"
            >
              — Kosongkan (hapus nilai)
            </button>
          )}
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted">Tidak ada pilihan yang cocok.</div>
          ) : (
            filtered.map((opt) => (
              <button
                key={opt}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(opt);
                }}
                className={`block w-full px-3 py-1.5 text-left text-sm transition hover:bg-line/40 ${
                  opt === value ? 'font-semibold text-coal' : 'text-coal/80'
                }`}
              >
                {opt === value && '✓ '}
                {opt}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function FieldInput({ field, value, onChange }) {
  const base =
    'w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-coal transition focus:border-ink focus:outline-none';
  const common = { value: value ?? '', onChange: (e) => onChange(e.target.value) };

  if (field.field_type === 'date') {
    return <input type="date" className={base} {...common} />;
  }
  if (field.field_type === 'number') {
    return <input type="number" step="any" className={base} {...common} />;
  }
  if (field.field_type === 'dropdown') {
    return <SearchableSelect options={field.options || []} value={value ?? ''} onChange={onChange} />;
  }
  return <input type="text" className={base} {...common} />;
}

export default function EmployeeFormModal({ fields, employee, onSave, onClose }) {
  const [nama, setNama] = useState(employee?.nama_lengkap ?? '');
  const [biodata, setBiodata] = useState(employee?.biodata ?? {});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNama(employee?.nama_lengkap ?? '');
    setBiodata(employee?.biodata ?? {});
    setError('');
  }, [employee]);

  const setValue = (fieldId, value) => setBiodata((prev) => ({ ...prev, [fieldId]: value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!nama.trim()) {
      setError('Nama Lengkap wajib diisi.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave({ nama_lengkap: nama.trim(), biodata });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={employee ? 'Edit Personel' : 'Tambah Personel'} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">
            Nama Lengkap *
          </label>
          <input
            type="text"
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-coal transition focus:border-ink focus:outline-none"
            autoFocus
          />
        </div>

        {fields.map((f) => (
          <div key={f.id}>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">
              {f.label}
            </label>
            <FieldInput field={f} value={biodata[String(f.id)]} onChange={(v) => setValue(String(f.id), v)} />
          </div>
        ))}

        {error && <div className="rounded-lg bg-clay/10 px-3 py-2 text-sm text-clay">{error}</div>}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-line px-5 py-2 text-xs font-semibold uppercase tracking-wider text-coal transition hover:bg-line/50"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-ink px-5 py-2 text-xs font-semibold uppercase tracking-wider text-cream transition hover:bg-ink/90 disabled:opacity-50"
          >
            {saving ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </form>
    </Modal>
  );
}