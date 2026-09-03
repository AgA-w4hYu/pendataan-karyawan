import { useEffect, useState } from 'react';
import Modal from './Modal';
import ConfirmDialog from './ConfirmDialog';

const TYPE_LABELS = { text: 'Teks', date: 'Tanggal', number: 'Angka', dropdown: 'Dropdown' };

function OptionsEditor({ value, onChange }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">
        Pilihan (satu per baris atau pisahkan dengan koma)
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder={'IT\nHRD\nFinance'}
        className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-coal transition focus:border-ink focus:outline-none"
      />
    </div>
  );
}

export default function FieldManagerModal({ fields, onClose, onCreate, onUpdate, onDelete, onReorder }) {
  const [items, setItems] = useState(fields);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Form field baru
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState('text');
  const [newOptions, setNewOptions] = useState('');

  // Edit inline
  const [editId, setEditId] = useState(null);
  const [editLabel, setEditLabel] = useState('');
  const [editType, setEditType] = useState('text');
  const [editOptions, setEditOptions] = useState('');

  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => setItems(fields), [fields]);

  const startEdit = (f) => {
    setEditId(f.id);
    setEditLabel(f.label);
    setEditType(f.field_type);
    setEditOptions((f.options || []).join('\n'));
  };

  const submitCreate = async (e) => {
    e.preventDefault();
    if (!newLabel.trim()) {
      setError('Label field tidak boleh kosong.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onCreate({ label: newLabel.trim(), field_type: newType, options: newOptions });
      setNewLabel('');
      setNewType('text');
      setNewOptions('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const submitEdit = async () => {
    if (!editLabel.trim()) {
      setError('Label field tidak boleh kosong.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onUpdate(editId, { label: editLabel.trim(), field_type: editType, options: editOptions });
      setEditId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const move = (index, dir) => {
    const next = [...items];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    onReorder(next.map((f) => f.id));
  };

  const typeBadge = (type) => (
    <span className="rounded-full border border-line bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
      {TYPE_LABELS[type] || type}
    </span>
  );

  return (
    <Modal title="Kelola Kolom Biodata" onClose={onClose} wide>
      {/* Form tambah field baru */}
      <form onSubmit={submitCreate} className="mb-6 rounded-xl border border-line bg-white p-4">
        <div className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">+ Tambah Kolom Baru</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">
              Judul Kolom
            </label>
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="misal: Nomor BPJS"
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-coal transition focus:border-ink focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">
              Tipe
            </label>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-coal transition focus:border-ink focus:outline-none"
            >
              <option value="text">Teks</option>
              <option value="date">Tanggal</option>
              <option value="number">Angka</option>
              <option value="dropdown">Dropdown / Pilihan</option>
            </select>
          </div>
        </div>
        {newType === 'dropdown' && (
          <div className="mt-3">
            <OptionsEditor value={newOptions} onChange={setNewOptions} />
          </div>
        )}
        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-ink px-5 py-2 text-xs font-semibold uppercase tracking-wider text-cream transition hover:bg-ink/90 disabled:opacity-50"
          >
            Tambah Kolom
          </button>
        </div>
      </form>

      {error && <div className="mb-4 rounded-lg bg-clay/10 px-3 py-2 text-sm text-clay">{error}</div>}

      {/* Daftar field */}
      <div className="space-y-2">
        {items.length === 0 && (
          <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
            Belum ada kolom biodata. Tambahkan kolom pertama di atas.
          </p>
        )}
        {items.map((f, index) => (
          <div key={f.id} className="rounded-xl border border-line bg-white p-3">
            {editId === f.id ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">
                      Judul Kolom
                    </label>
                    <input
                      type="text"
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-coal transition focus:border-ink focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">
                      Tipe
                    </label>
                    <select
                      value={editType}
                      onChange={(e) => setEditType(e.target.value)}
                      className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-coal transition focus:border-ink focus:outline-none"
                    >
                      <option value="text">Teks</option>
                      <option value="date">Tanggal</option>
                      <option value="number">Angka</option>
                      <option value="dropdown">Dropdown / Pilihan</option>
                    </select>
                  </div>
                </div>
                {editType === 'dropdown' && (
                  <OptionsEditor value={editOptions} onChange={setEditOptions} />
                )}
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setEditId(null)}
                    className="rounded-full border border-line px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-coal transition hover:bg-line/50"
                  >
                    Batal
                  </button>
                  <button
                    onClick={submitEdit}
                    disabled={busy}
                    className="rounded-full bg-ink px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-cream transition hover:bg-ink/90 disabled:opacity-50"
                  >
                    Simpan
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    className="text-[10px] leading-none text-muted transition hover:text-coal disabled:opacity-30"
                    title="Naik"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => move(index, 1)}
                    disabled={index === items.length - 1}
                    className="text-[10px] leading-none text-muted transition hover:text-coal disabled:opacity-30"
                    title="Turun"
                  >
                    ▼
                  </button>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-coal">{f.label}</div>
                  <div className="mt-1">{typeBadge(f.field_type)}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => startEdit(f)}
                    className="rounded-full border border-line px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-coal transition hover:bg-line/50"
                  >
                    Ubah
                  </button>
                  <button
                    onClick={() => setDeleteTarget(f)}
                    className="rounded-full border border-clay/40 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-clay transition hover:bg-clay/10"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-muted">
        Kolom baru otomatis muncul (kosong) di semua personel. Mengubah judul kolom tidak menghapus data yang
        sudah diisi. Menghapus kolom akan menghapus nilainya di semua personel (permanen).
      </p>

      {deleteTarget && (
        <ConfirmDialog
          title="Hapus Kolom"
          message={`Yakin hapus kolom "${deleteTarget.label}"? Seluruh nilai kolom ini di semua personel akan terhapus permanen dan tidak bisa dikembalikan.`}
          onConfirm={async () => {
            try {
              await onDelete(deleteTarget.id);
              setDeleteTarget(null);
            } catch (err) {
              setError(err.message);
              setDeleteTarget(null);
            }
          }}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </Modal>
  );
}