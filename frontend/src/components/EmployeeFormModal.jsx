import { useEffect, useState } from 'react';
import Modal from './Modal';

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
    return (
      <select className={base} {...common}>
        <option value="">—</option>
        {(field.options || []).map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
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
    <Modal title={employee ? 'Edit Karyawan' : 'Tambah Karyawan'} onClose={onClose} wide>
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