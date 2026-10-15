import { useEffect, useState } from 'react';
import Modal from './Modal';
import ConfirmDialog from './ConfirmDialog';

const TYPE_LABELS = {
  text: 'Teks',
  date: 'Tanggal',
  number: 'Angka',
  dropdown: 'Dropdown',
  ordered_select: 'Dropdown Berurutan',
};

function OptionsEditor({ value, onChange }) {
  return (
    <div>
      <label className="mb-1 block font-mono text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">
        Pilihan (satu per baris atau pisahkan dengan koma)
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder={'IT\nHRD\nFinance'}
        className="w-full rounded-card border border-ink bg-bone px-3 py-2 text-sm text-ink transition focus:border-magenta focus:outline-none"
      />
    </div>
  );
}

// ============================================================
// Panel "Kelola Opsi" — khusus field bertipe Dropdown Berurutan.
// options: [{ id?, label, used_count? }] — urutan array = urutan hierarki
// (indeks 0 = paling atas / paling tinggi). Opsi dengan `id` adalah opsi
// lama (nilainya terpakai personel); tanpa `id` = opsi baru.
// ============================================================
function OrderedOptionsEditor({ options, onChange }) {
  const [newLabel, setNewLabel] = useState('');
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null); // { opt, index }

  const setLabel = (i, label) => onChange(options.map((o, idx) => (idx === i ? { ...o, label } : o)));

  const move = (i, dir) => {
    const target = i + dir;
    if (target < 0 || target >= options.length) return;
    const next = [...options];
    [next[i], next[target]] = [next[target], next[i]];
    onChange(next);
  };

  // Pindahkan item dari dragIndex ke posisi `to` (drop di baris `to`).
  const moveTo = (from, to) => {
    if (from === to || from < 0 || to < 0 || from >= options.length || to >= options.length) return;
    const next = [...options];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  const addOption = () => {
    const label = newLabel.trim();
    if (!label) return;
    onChange([...options, { label }]);
    setNewLabel('');
  };

  const insertAt = (position, label) => {
    const trimmed = (label ?? '').trim();
    if (!trimmed) return;
    const next = [...options];
    next.splice(position, 0, { label: trimmed });
    onChange(next);
    setNewLabel('');
  };

  const confirmDelete = () => {
    const { index } = deleteTarget;
    onChange(options.filter((_, idx) => idx !== index));
    setDeleteTarget(null);
  };

  const rowBase = 'flex items-center gap-2 rounded-card border border-ink/40 bg-bone px-2 py-1.5 transition';

  return (
    <div className="rounded-card border border-ink bg-lilacshadow/10 p-3">
      <div className="mb-1 font-mono text-[12px] font-bold uppercase tracking-[0.14em] text-muted">
        Kelola Opsi (Hierarki)
      </div>
      <p className="mb-3 text-xs leading-relaxed text-ink/70">
        Urutan di bawah = urutan hierarki (paling atas = paling tinggi). Seret ikon ☰ untuk memindah,
        atau pakai tombol ▲▼. Opsi di dropdown &amp; hasil sort tabel mengikuti urutan ini.
      </p>

      {options.length === 0 && (
        <p className="mb-2 rounded-card border border-dashed border-muted/60 px-3 py-3 text-center text-xs text-muted">
          Belum ada opsi. Tambahkan opsi pertama di bawah — mulai dari yang paling tinggi.
        </p>
      )}

      <div className="space-y-1.5">
        {options.map((opt, i) => (
          <div
            key={opt.id ?? `new-${i}`}
            onDragOver={(e) => {
              e.preventDefault();
              if (dragIndex !== null && overIndex !== i) setOverIndex(i);
            }}
            onDrop={(e) => {
              e.preventDefault();
              moveTo(dragIndex, i);
              setDragIndex(null);
              setOverIndex(null);
            }}
            className={`${rowBase} ${
              dragIndex !== null && overIndex === i && dragIndex !== i
                ? 'border-magenta ring-1 ring-magenta'
                : 'border-ink/40'
            } ${dragIndex === i ? 'opacity-40' : ''}`}
          >
            {/* Handle drag */}
            <div
              draggable
              onDragStart={(e) => {
                setDragIndex(i);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragEnd={() => {
                setDragIndex(null);
                setOverIndex(null);
              }}
              className="cursor-grab select-none px-1 text-sm text-muted active:cursor-grabbing"
              title="Seret untuk mengubah urutan"
            >
              ☰
            </div>

            <span className="w-5 shrink-0 text-center text-[10px] font-bold text-muted">{i + 1}</span>

            {/* Edit label tanpa mengubah posisi */}
            <input
              type="text"
              value={opt.label}
              onChange={(e) => setLabel(i, e.target.value)}                className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm text-ink transition focus:border-magenta focus:bg-bone focus:outline-none"
            />

            {opt.used_count > 0 && (
              <span
                className="shrink-0 rounded-pill border border-magenta px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-magenta"
                title={`Dipakai oleh ${opt.used_count} personel`}
              >
                {opt.used_count}×
              </span>
            )}

            {/* Kontrol urutan & sisip */}
            <div className="flex shrink-0 items-center gap-0.5 text-xs">
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="rounded px-1 py-0.5 text-muted transition hover:text-ink disabled:opacity-30"
                title="Naikkan satu posisi"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === options.length - 1}
                className="rounded px-1 py-0.5 text-muted transition hover:text-ink disabled:opacity-30"
                title="Turunkan satu posisi"
              >
                ▼
              </button>
              <button
                type="button"
                onClick={() => insertAt(i, newLabel)}
                disabled={!newLabel.trim()}
                className="rounded px-1 py-0.5 text-muted transition hover:text-magenta disabled:opacity-30"
                title={`Sisipkan "${newLabel.trim() || '…'}" di atas opsi ini`}
              >
                +↑
              </button>
              <button
                type="button"
                onClick={() => insertAt(i + 1, newLabel)}
                disabled={!newLabel.trim()}
                className="rounded px-1 py-0.5 text-muted transition hover:text-magenta disabled:opacity-30"
                title={`Sisipkan "${newLabel.trim() || '…'}" di bawah opsi ini`}
              >
                +↓
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget({ opt, index: i })}
                className="rounded px-1 py-0.5 text-firecracker transition hover:bg-firecracker/10"
                title="Hapus opsi"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Tambah opsi baru (masuk paling bawah; bisa disisipkan lewat +↑ / +↓) */}
      <div className="mt-3 flex gap-2">
        <input
          type="text"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addOption();
            }
          }}
          placeholder="Ketik opsi baru, misal: KOMBES POL"
          className="min-w-0 flex-1 rounded-card border border-ink bg-bone px-3 py-1.5 text-sm text-ink transition focus:border-magenta focus:outline-none"
        />
        <button
          type="button"
          onClick={addOption}
          disabled={!newLabel.trim()}
          className="shrink-0 rounded-pill border border-ink px-3 py-1.5 font-grotesk text-xs font-bold uppercase tracking-[0.05em] text-ink transition hover:bg-ink hover:text-bone disabled:opacity-40"
        >
          + Tambah
        </button>
      </div>

      {deleteTarget && (
        <ConfirmDialog
          title="Hapus Opsi"
          confirmLabel="Hapus Opsi"
          message={
            deleteTarget.opt.used_count > 0
              ? `Opsi "${deleteTarget.opt.label}" sedang dipakai oleh ${deleteTarget.opt.used_count} personel. Jika dihapus, data personel tersebut akan ditandai "Perlu diisi ulang" sampai dipetakan ulang. Lanjutkan?`
              : `Hapus opsi "${deleteTarget.opt.label}" dari daftar hierarki?`
          }
          onConfirm={confirmDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

const TYPE_OPTIONS = (
  <>
    <option value="text">Teks</option>
    <option value="date">Tanggal</option>
    <option value="number">Angka</option>
    <option value="dropdown">Dropdown / Pilihan</option>
    <option value="ordered_select">Dropdown Berurutan</option>
  </>
);

export default function FieldManagerModal({ fields, onClose, onCreate, onUpdate, onDelete, onReorder }) {
  const [items, setItems] = useState(fields);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Form field baru
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState('text');
  const [newOptions, setNewOptions] = useState(''); // teks utk tipe dropdown
  const [newOrdered, setNewOrdered] = useState([]); // array utk tipe ordered_select

  // Edit inline
  const [editId, setEditId] = useState(null);
  const [editLabel, setEditLabel] = useState('');
  const [editType, setEditType] = useState('text');
  const [editOptions, setEditOptions] = useState('');
  const [editOrdered, setEditOrdered] = useState([]);

  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => setItems(fields), [fields]);

  const startEdit = (f) => {
    setEditId(f.id);
    setEditLabel(f.label);
    setEditType(f.field_type);
    setEditOptions((f.options || []).map((o) => (typeof o === 'string' ? o : o.label)).join('\n'));
    setEditOrdered(
      f.field_type === 'ordered_select'
        ? (f.options || []).map((o) => ({ id: o.id, label: o.label, used_count: o.used_count }))
        : [],
    );
    setError('');
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
      await onCreate({
        label: newLabel.trim(),
        field_type: newType,
        options: newType === 'ordered_select' ? newOrdered : newOptions,
      });
      setNewLabel('');
      setNewType('text');
      setNewOptions('');
      setNewOrdered([]);
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
      await onUpdate(editId, {
        label: editLabel.trim(),
        field_type: editType,
        options: editType === 'ordered_select' ? editOrdered : editOptions,
      });
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
    <span className="rounded-pill border border-ink px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
      {TYPE_LABELS[type] || type}
    </span>
  );

  return (
    <Modal title="Kelola Kolom Biodata" onClose={onClose} wide>
      {/* Form tambah field baru */}
      <form onSubmit={submitCreate} className="mb-6 rounded-card border border-ink bg-lilacshadow/10 p-4">
        <div className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">+ Tambah Kolom Baru</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block font-mono text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">
              Judul Kolom
            </label>
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="misal: Pangkat"
              className="w-full rounded-card border border-ink bg-bone px-3 py-2 text-sm text-ink transition focus:border-magenta focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block font-mono text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">
              Tipe Kolom
            </label>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="w-full rounded-card border border-ink bg-bone px-3 py-2 text-sm text-ink transition focus:border-magenta focus:outline-none"
            >
              {TYPE_OPTIONS}
            </select>
          </div>
        </div>
        {newType === 'dropdown' && (
          <div className="mt-3">
            <OptionsEditor value={newOptions} onChange={setNewOptions} />
          </div>
        )}
        {newType === 'ordered_select' && (
          <div className="mt-3">
            <OrderedOptionsEditor options={newOrdered} onChange={setNewOrdered} />
          </div>
        )}
        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            disabled={busy}
            className="rounded-pill bg-magenta px-5 py-2 font-grotesk text-xs font-bold uppercase tracking-[0.05em] text-bone transition hover:bg-rosedark disabled:opacity-50"
          >
            Tambah Kolom
          </button>
        </div>
      </form>

      {error && <div className="mb-4 rounded-card border border-firecracker bg-firecracker/10 px-3 py-2 text-sm text-firecracker">{error}</div>}

      {/* Daftar field */}
      <div className="space-y-2">
        {items.length === 0 && (
          <p className="rounded-card border border-dashed border-muted/60 px-4 py-6 text-center text-sm text-muted">
            Belum ada kolom biodata. Tambahkan kolom pertama di atas.
          </p>
        )}
        {items.map((f, index) => (
          <div key={f.id} className="rounded-card border border-ink/40 bg-bone p-3">
            {editId === f.id ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block font-mono text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">
                      Judul Kolom
                    </label>
                    <input
                      type="text"
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      className="w-full rounded-card border border-ink bg-bone px-3 py-2 text-sm text-ink transition focus:border-magenta focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-mono text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">
                      Tipe Kolom
                    </label>
                    <select
                      value={editType}
                      onChange={(e) => setEditType(e.target.value)}
                      className="w-full rounded-card border border-ink bg-bone px-3 py-2 text-sm text-ink transition focus:border-magenta focus:outline-none"
                    >
                      {TYPE_OPTIONS}
                    </select>
                  </div>
                </div>
                {editType === 'ordered_select' && (
                  <div className="space-y-2">
                    <p className="rounded-card border border-buttery bg-buttery/30 px-3 py-2 text-xs leading-relaxed text-ink">
                      Mengubah tipe ke Dropdown Berurutan tidak mengubah data lama otomatis — nilai teks lama
                      akan ditandai "Perlu diisi ulang" sampai dipetakan ulang ke opsi.
                    </p>
                    <OrderedOptionsEditor options={editOrdered} onChange={setEditOrdered} />
                  </div>
                )}
                {editType === 'dropdown' && (
                  <OptionsEditor value={editOptions} onChange={setEditOptions} />
                )}
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setEditId(null)}
                    className="rounded-pill border border-ink px-4 py-1.5 font-grotesk text-xs font-bold uppercase tracking-[0.05em] text-ink transition hover:bg-ink hover:text-bone"
                  >
                    Batal
                  </button>
                  <button
                    onClick={submitEdit}
                    disabled={busy}
                    className="rounded-pill bg-magenta px-4 py-1.5 font-grotesk text-xs font-bold uppercase tracking-[0.05em] text-bone transition hover:bg-rosedark disabled:opacity-50"
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
                    className="text-[10px] leading-none text-muted transition hover:text-ink disabled:opacity-30"
                    title="Naik"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => move(index, 1)}
                    disabled={index === items.length - 1}
                    className="text-[10px] leading-none text-muted transition hover:text-ink disabled:opacity-30"
                    title="Turun"
                  >
                    ▼
                  </button>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-ink">{f.label}</div>
                  <div className="mt-1 flex items-center gap-2">
                    {typeBadge(f.field_type)}
                    {f.field_type === 'ordered_select' && (
                      <span className="text-[10px] text-muted">
                        {(f.options || []).length} opsi
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => startEdit(f)}
                    className="rounded-pill border border-ink px-4 py-1.5 font-grotesk text-xs font-bold uppercase tracking-[0.05em] text-ink transition hover:bg-ink hover:text-bone"
                  >
                    Ubah
                  </button>
                  <button
                    onClick={() => setDeleteTarget(f)}
                    className="rounded-pill border border-firecracker px-4 py-1.5 font-grotesk text-xs font-bold uppercase tracking-[0.05em] text-firecracker transition hover:bg-firecracker hover:text-bone"
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
