import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { guessColumns, parseUploadFile } from '../lib/fileparse';
import Modal from './Modal';

// ============================================================
// Fitur "Isi Biodata dari File (AI)" — generalisasi dari
// "Isi Pangkat dari File (AI)" ke SEMUA kolom biodata (PRD).
// Alur: Upload → Pemetaan kolom dinamis (Nama Lengkap wajib
// tepat 1×, tiap kolom biodata hanya dari 1 kolom Excel —
// dicegah lewat UI) → Preview per kolom dengan deteksi konflik
// (timpa/pertahankan, bulk + per baris) → Terapkan → Ringkasan.
// Prinsip: tidak pernah menebak untuk nilai ragu dan tidak
// pernah menimpa data tanpa persetujuan admin.
// ============================================================

const selectCls =
  'min-w-0 flex-1 cursor-pointer rounded-card border border-ink bg-bone px-3 py-1.5 font-mono text-[12px] uppercase tracking-wide text-ink transition focus:border-magenta focus:outline-none';
const btnGhost =
  'rounded-pill border border-ink bg-bone px-5 py-2 font-grotesk text-xs font-bold uppercase tracking-[0.05em] text-ink transition hover:bg-ink hover:text-bone';
// Tombol aksi modal (fill solid di dalam modal — sama peran dgn tombol utama).
const btnRose =
  'rounded-pill bg-magenta px-5 py-2 font-grotesk text-xs font-bold uppercase tracking-[0.05em] text-bone transition hover:bg-rosedark disabled:cursor-not-allowed disabled:opacity-40';

const TYPE_LABEL = {
  text: 'Teks Bebas',
  date: 'Tanggal',
  number: 'Angka',
  dropdown: 'Dropdown',
  ordered_select: 'Dropdown Berurutan',
};

// Mono Label Tag (PRD Section 6): tanpa fill, border 1px warna status,
// radius pill 100px, JetBrains Mono 12px.
function Badge({ tone, children }) {
  const tones = {
    green: 'border-matcha text-ink',
    amber: 'border-firecracker text-firecracker',
    gray: 'border-muted/60 text-muted',
    rose: 'border-magenta text-magenta',
  };
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-pill border bg-bone px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide ${tones[tone] || tones.gray}`}>
      {children}
    </span>
  );
}

// Badge ringkas status sebuah sel (PRD Section 4).
function cellBadge(cell, decision) {
  switch (cell.status) {
    case 'match':
      return <Badge tone="gray">➖ Sudah sesuai</Badge>;
    case 'fill':
      return <Badge tone="green">✅ Akan diisi</Badge>;
    case 'conflict':
      if (decision?.action === 'set') return <Badge tone="rose">⏫ Timpa</Badge>;
      if (decision?.action === 'keep') return <Badge tone="gray">⏸ Dipertahankan</Badge>;
      return <Badge tone="amber">⚠️ Konflik</Badge>;
    case 'unmapped':
      if (decision?.action === 'new_option') return <Badge tone="rose">➕ Opsi baru</Badge>;
      if (decision?.action === 'set') return <Badge tone="green">✅ Dipilih manual</Badge>;
      if (decision?.action === 'keep') return <Badge tone="gray">⏸ Dipertahankan</Badge>;
      return <Badge tone="amber">⚠️ Opsi belum ada</Badge>;
    case 'invalid':
      return <Badge tone="amber">⚠️ Format tidak dikenali</Badge>;
    default:
      return <Badge tone="gray">—</Badge>;
  }
}

/** Nilai yang akan ditulis bila sel diputuskan "timpa/isi" (sebelum keputusan admin). */
function autoValue(cell) {
  return cell.field_type === 'ordered_select' ? String(cell.option_id ?? '') : cell.excel_value;
}

/**
 * Hitung ulang status sel terhadap biodata karyawan terpilih
 * (dipakai saat admin mengganti kandidat nama secara manual).
 */
function recalcCells(cells, values, optionLabelOf) {
  return cells.map((cell) => {
    const cv = values?.[cell.field_id] ?? '';
    const c = { ...cell, current_value: cv, current_label: cv };
    if (cell.field_type === 'ordered_select') {
      c.current_label = optionLabelOf(cell.field_id, cv);
      if (cell.status === 'unmapped' || cell.status === 'invalid') return c; // tidak bergantung karyawan
      const same = cv !== '' && String(cv) === String(cell.option_id ?? '');
      c.status = same ? 'match' : cv === '' ? 'fill' : 'conflict';
      return c;
    }
    if (cell.status === 'invalid') return c;
    const same = cv !== '' && cv === cell.excel_value;
    c.status = same ? 'match' : cv === '' ? 'fill' : 'conflict';
    return c;
  });
}

/** Keputusan efektif sebuah sel (null = tidak perlu ditulis saat apply). */
function cellAction(item, cell) {
  if (!item.employeeId || item.skipped) return null;
  const dec = item.decisions?.[cell.field_id];
  if (cell.status === 'match' || cell.status === 'empty') return null;
  if (cell.status === 'fill') return dec?.action === 'keep' ? { action: 'keep' } : { action: 'set', value: autoValue(cell) };
  if (cell.status === 'conflict') {
    if (dec?.action === 'set') return { action: 'set', value: autoValue(cell) };
    if (dec?.action === 'keep') return { action: 'keep' };
    return null; // belum diputuskan → baris pending
  }
  if (cell.status === 'unmapped') {
    if (dec?.action === 'set' && dec.value) return { action: 'set', value: String(dec.value) };
    if (dec?.action === 'new_option' && dec.new_option_label?.trim()) {
      return { action: 'new_option', new_option_label: dec.new_option_label.trim() };
    }
    if (dec?.action === 'keep') return { action: 'keep' };
    return null;
  }
  if (cell.status === 'invalid') {
    return dec?.action === 'keep' ? { action: 'keep' } : null;
  }
  return null;
}

/** 'ready' = baris siap diterapkan; 'pending' = masih butuh keputusan admin. */
function rowState(item) {
  if (item.skipped) return 'ready'; // dilewati eksplisit → dianggap selesai
  if (!item.employeeId) return 'pending';
  for (const cell of item.cells) {
    if (cellAction(item, cell) === null) {
      if (cell.status === 'conflict' || cell.status === 'unmapped' || cell.status === 'invalid') return 'pending';
    }
  }
  return 'ready';
}

export default function BiodataImportModal({ onClose, onApplied }) {
  const [step, setStep] = useState('upload'); // upload | mapping | preview | summary
  const [busy, setBusy] = useState(false);
  const [matching, setMatching] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');

  const [fields, setFields] = useState([]); // semua kolom biodata (target pemetaan)
  const [fileName, setFileName] = useState('');
  const [table, setTable] = useState(null); // { headers, rows, sheetName? }
  const [mappings, setMappings] = useState({}); // { colIndexExcel: 'name' | fieldId }

  const [items, setItems] = useState([]);
  const [detailRow, setDetailRow] = useState(null); // item yang dibuka di modal detail
  const [summary, setSummary] = useState(null);
  const fileRef = useRef(null);

  // Muat daftar kolom biodata untuk dropdown pemetaan.
  useEffect(() => {
    api.getFields()
      .then((fs) => setFields(fs || []))
      .catch((err) => setError(err.message));
  }, []);

  const optionLabelOf = useMemo(() => {
    const maps = {};
    for (const f of fields) {
      if (f.field_type === 'ordered_select') {
        maps[f.id] = Object.fromEntries((f.options || []).map((o) => [String(o.id), o.label]));
      }
    }
    return (fieldId, value) => maps[fieldId]?.[String(value)] ?? (value ? String(value) : '');
  }, [fields]);

  const pendingCount = items.filter((it) => rowState(it) === 'pending').length;
  const readyCount = items.filter((it) => rowState(it) === 'ready').length;
  const notFoundCount = items.filter((it) => it.name_status === 'not_found' && !it.employeeId).length;
  const conflictCount = items.reduce(
    (n, it) => n + it.cells.filter((c) => c.status === 'conflict' && !it.decisions?.[c.field_id]).length,
    0,
  );

  const mappedFields = useMemo(() => {
    const ids = [...new Set(Object.values(mappings).filter((v) => v !== 'name' && v != null))].map(Number);
    return fields.filter((f) => ids.includes(f.id));
  }, [mappings, fields]);

  const nameCol = useMemo(() => {
    const col = Object.entries(mappings).find(([, t]) => t === 'name');
    return col ? Number(col[0]) : -1;
  }, [mappings]);

  const updateItem = (rowIndex, patch) =>
    setItems((prev) => prev.map((it) => (it.row_index === rowIndex ? { ...it, ...patch } : it)));

  // ===== Langkah 1: Upload =====
  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setBusy(true);
    setError('');
    try {
      const ext = (f.name.split('.').pop() || '').toLowerCase();
      // .doc (Word biner lama) diparse di server; lainnya di browser.
      const parsed = ext === 'doc' ? await api.parseImportDoc(f) : await parseUploadFile(f);
      if (!parsed?.rows?.length) {
        throw new Error('Tidak ada baris data yang terbaca dari file ini.');
      }
      setFileName(f.name);
      setTable(parsed);

      // Tebakan awal: kolom nama wajib; kolom pangkat → field Dropdown
      // Berurutan "Pangkat" bila ada; kolom nomor → field No. HP/NRP bila ada.
      const g = guessColumns(parsed.headers, parsed.rows);
      const m = {};
      if (g.nameCol >= 0) m[g.nameCol] = 'name';
      if (g.rankCol >= 0 && g.rankCol !== g.nameCol) {
        const ordered = fields.filter((x) => x.field_type === 'ordered_select');
        const pangkat = ordered.find((x) => /pangkat/i.test(x.label)) || ordered[0];
        if (pangkat) m[g.rankCol] = pangkat.id;
      }
      if (g.idCol >= 0 && m[g.idCol] === undefined) {
        const idField = fields.find(
          (x) => ['text', 'number'].includes(x.field_type) && /no\.?\s*hp|hp|telpon|telepon|phone|nrp|nip/i.test(x.label),
        );
        if (idField) m[g.idCol] = idField.id;
      }
      setMappings(m);
      setStep('mapping');
    } catch (err) {
      setError(err.message || 'Gagal membaca file.');
    } finally {
      setBusy(false);
    }
  };

  // ===== Langkah 2 → 3: Pemetaan + pencocokan =====
  const doMatch = async () => {
    if (nameCol < 0) {
      setError('Pilih dulu kolom yang berisi Nama Lengkap (kunci pencocokan).');
      return;
    }
    const fieldMappings = Object.fromEntries(
      Object.entries(mappings).filter(([, t]) => t !== 'name' && t != null),
    );
    if (Object.keys(fieldMappings).length === 0) {
      setError('Petakan minimal satu kolom biodata untuk diisi.');
      return;
    }
    setMatching(true);
    setError('');
    try {
      const res = await api.matchBiodata({
        file_name: fileName,
        headers: table.headers,
        rows: table.rows,
        name_col: nameCol,
        mappings: fieldMappings,
      });
      setItems(
        (res.results || []).map((r) => ({
          ...r,
          employeeId: r.employee?.id ?? null,
          employeeName: r.employee?.nama ?? '',
          decisions: {},
          skipped: r.name_status === 'not_found', // baris tak ditemukan otomatis dilewati (PRD)
        })),
      );
      setStep('preview');
    } catch (err) {
      setError(err.message);
    } finally {
      setMatching(false);
    }
  };

  // Ganti kandidat karyawan pada satu baris → hitung ulang status sel.
  const chooseEmployee = (item, empId) => {
    const cand = item.candidates.find((c) => c.id === empId);
    const values = empId ? item.candidate_values?.[empId] : null;
    const labelOf = (fid, v) => optionLabelOf(fid, v);
    updateItem(item.row_index, {
      employeeId: empId,
      employeeName: cand?.nama ?? '',
      cells: empId ? recalcCells(item.cells, values, labelOf) : item.cells,
      decisions: {}, // keputusan lama tidak lagi relevan untuk karyawan berbeda
    });
  };

  // ===== Bulk: putuskan semua konflik sekaligus (PRD Langkah 3) =====
  const bulkResolve = (mode) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.skipped || !it.employeeId) return it;
        const decisions = { ...it.decisions };
        let changed = false;
        for (const cell of it.cells) {
          if (cell.status === 'conflict' && !decisions[cell.field_id]) {
            decisions[cell.field_id] = mode === 'override' ? { action: 'set' } : { action: 'keep' };
            changed = true;
          }
        }
        return changed ? { ...it, decisions } : it;
      }),
    );
  };

  // ===== Langkah 4: Terapkan =====
  const doApply = async () => {
    if (pendingCount > 0) return;
    setApplying(true);
    setError('');
    try {
      const rows = [];
      for (const it of items) {
        if (it.skipped || !it.employeeId) continue;
        const cells = [];
        for (const cell of it.cells) {
          const act = cellAction(it, cell);
          if (!act) continue;
          cells.push({ field_id: cell.field_id, ...act });
        }
        if (cells.length > 0) rows.push({ employee_id: it.employeeId, excel_name: it.excel_name, cells });
      }
      const res = await api.applyBiodata({ rows });
      // Ringkasan harus jujur (PRD Section 4): pakai angka operasi NYATA dari
      // backend (applied_rows/written_cells/invalid_cells), bukan asumsi frontend.
      setSummary({
        ...res,
        not_found: notFoundCount,
        skipped_rows: res.skipped_rows ?? 0,
      });
      setStep('summary');
      onApplied?.(res); // App me-refresh fields (opsi baru) + tabel + statistik, toast sesuai hasil
    } catch (err) {
      setError(err.message);
    } finally {
      setApplying(false);
    }
  };

  const headerOptions = (table?.headers || []).map((h, i) => (
    <option key={i} value={i}>
      {h || `(Kolom ${i + 1})`}
      {table?.rows?.[0]?.[i] ? ` — contoh: ${String(table.rows[0][i]).slice(0, 28)}` : ''}
    </option>
  ));

  // Opsi target untuk satu kolom Excel — target yang sudah dipakai kolom lain
  // otomatis disembunyikan (PRD: dicegah lewat UI, bukan cuma validasi submit).
  const targetOptionsFor = (colIdx) => {
    const used = {};
    let nameTaken = false;
    for (const [ci, t] of Object.entries(mappings)) {
      if (Number(ci) === colIdx) continue;
      if (t === 'name') nameTaken = true;
      else if (t != null) used[Number(t)] = true;
    }
    return (
      <>
        <option value="ignore">— Abaikan (jangan diimpor) —</option>
        {!nameTaken && <option value="name">Nama Lengkap (kunci pencocokan)</option>}
        {fields
          .filter((f) => !used[f.id])
          .map((f) => (
            <option key={f.id} value={f.id}>
              {f.label} ({TYPE_LABEL[f.field_type] || f.field_type})
            </option>
          ))}
      </>
    );
  };

  const setMapping = (colIdx, value) => {
    setMappings((prev) => {
      const next = { ...prev };
      if (value === 'ignore') delete next[colIdx];
      else next[colIdx] = value === 'name' ? 'name' : Number(value);
      return next;
    });
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-pure/50" onClick={busy || matching || applying ? undefined : onClose} />
        <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-card border-2 border-pure bg-bone text-ink">
          {/* Header modal */}
          <div className="flex items-center justify-between border-b border-ink px-6 py-4">
            <div>
              <h2 className="font-display text-base uppercase leading-[0.9] tracking-wide text-ink">Isi Biodata dari File (AI)</h2>
              <div className="text-[11px] uppercase tracking-wider text-muted">
                {step === 'upload' && 'Langkah 1 dari 3 — Upload file'}
                {step === 'mapping' && 'Langkah 2 dari 3 — Pemetaan kolom'}
                {step === 'preview' && 'Langkah 3 dari 3 — Cek hasil & putuskan konflik'}
                {step === 'summary' && 'Selesai — Ringkasan hasil'}
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={busy || matching || applying}
              className="rounded-pill border border-ink px-2 py-0.5 font-mono text-xs leading-none text-ink transition hover:bg-ink hover:text-bone disabled:opacity-40"
              aria-label="Tutup"
            >
              ✕
            </button>
          </div>

          {/* Konten */}
          <div className="overflow-y-auto px-6 py-5">
            {error && <div className="mb-4 rounded-card border border-firecracker bg-firecracker/10 px-3 py-2 text-sm text-firecracker">{error}</div>}

            {/* ===== Langkah 1: Upload ===== */}
            {step === 'upload' && (
              <div className="space-y-4">
                <p className="text-sm leading-relaxed text-ink/80">
                  Upload file (.xlsx, .xls, .csv, .docx, atau .doc lama) berisi data personel. Sistem mencocokkan{' '}
                  <b>Nama Lengkap</b> dengan personel yang ada, lalu mengisi <b>kolom biodata apa pun</b> yang Anda
                  petakan — semua hasil ditampilkan dulu untuk Anda periksa sebelum disimpan.
                </p>
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-ink bg-bone px-6 py-10 text-center transition hover:border-magenta hover:bg-magenta/5">
                  <span className="text-3xl">📄</span>
                  <span className="text-sm font-semibold text-ink">{busy ? 'Memproses file…' : 'Klik untuk pilih file'}</span>
                  <span className="text-xs text-muted">.xlsx / .xls / .csv / .docx / .doc — maks 10 MB</span>
                  <input type="file" accept=".xlsx,.xls,.csv,.docx,.doc" className="hidden" onChange={handleFile} disabled={busy} />
                </label>
                <div className="rounded-card border border-ink bg-lilacshadow/10 px-4 py-3 text-xs leading-relaxed text-ink/80">
                  <b>Cara kerja:</b> nama dicocokkan fleksibel (gelar seperti S.H., M.H. diabaikan). Nilai kolom{' '}
                  <b>Dropdown Berurutan</b> hanya diisi otomatis bila cocok dengan opsi yang sudah ada — kasus ragu{' '}
                  <b>selalu</b> diminta konfirmasi. Data yang sudah terisi dan berbeda <b>tidak pernah</b> ditimpa tanpa
                  persetujuan Anda. Semua proses berjalan lokal di aplikasi ini.
                </div>
              </div>
            )}

            {/* ===== Langkah 2: Pemetaan kolom (dinamis) ===== */}
            {step === 'mapping' && table && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge tone="green">✓ {fileName}</Badge>
                  <span className="text-muted">
                    {table.rows.length} baris × {table.headers.length} kolom terbaca
                    {table.sheetName ? ` (sheet "${table.sheetName}")` : ''}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-ink/80">
                  Petakan setiap kolom Excel ke <b>Nama Lengkap</b> (kunci pencocokan, wajib tepat 1×) dan/atau kolom
                  biodata mana pun. Kolom biodata yang sudah dipakai tidak muncul lagi di kolom lain. Kolom yang tidak
                  relevan diabaikan.
                </p>
                <div className="space-y-2">
                  {table.headers.map((h, i) => {
                    const sample = table.rows.find((r) => (r[i] || '').trim() !== '')?.[i] || '';
                    const val = mappings[i];
                    return (
                      <div key={i} className="flex flex-wrap items-center gap-3 rounded-card border border-ink/40 bg-bone px-4 py-2.5">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-ink">{h || `(Kolom ${i + 1})`}</div>
                          {sample && <div className="truncate text-xs text-muted">contoh: {String(sample).slice(0, 60)}</div>}
                        </div>
                        <span className="text-xs text-muted">→</span>
                        <select
                          value={val ?? 'ignore'}
                          onChange={(e) => setMapping(i, e.target.value)}
                          className={`${selectCls} max-w-xs`}
                        >
                          {targetOptionsFor(i)}
                        </select>
                      </div>
                    );
                  })}
                </div>
                <div className="overflow-x-auto rounded-card border-2 border-pure">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-hivis">
                        {table.headers.map((h, i) => {
                          const t = mappings[i];
                          return (
                            <th key={i} className={`whitespace-nowrap px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] ${t ? 'text-magenta' : 'text-pure'}`}>
                              {h || `Kolom ${i + 1}`}
                              {t === 'name' ? ' ⬅ nama' : t ? ' ⬅ biodata' : ''}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {table.rows.slice(0, 5).map((r, ri) => (
                        <tr key={ri} className="border-t border-ink/30">
                          {table.headers.map((_, ci) => (
                            <td key={ci} className={`whitespace-nowrap px-3 py-1.5 ${mappings[ci] ? 'text-ink' : 'text-muted'}`}>
                              {r[ci] || '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ===== Langkah 3: Preview & keputusan konflik ===== */}
            {step === 'preview' && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  {mappedFields.map((f) => (
                    <Badge key={f.id} tone="rose">
                      {f.label} <span className="font-normal opacity-70">({TYPE_LABEL[f.field_type]})</span>
                    </Badge>
                  ))}
                  <Badge tone="green">✅ {readyCount} siap</Badge>
                  <Badge tone="amber">⚠ {pendingCount} perlu keputusan</Badge>
                  {notFoundCount > 0 && <Badge tone="gray">❌ {notFoundCount} tidak ditemukan</Badge>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted">Selesaikan massal:</span>
                  <button
                    onClick={() => bulkResolve('override')}
                    disabled={conflictCount === 0}
                    className="rounded-pill border border-magenta px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-magenta transition hover:bg-magenta hover:text-bone disabled:opacity-40"
                  >
                    ⏫ Timpa semua konflik
                  </button>
                  <button
                    onClick={() => bulkResolve('keep')}
                    disabled={conflictCount === 0}
                    className="rounded-pill border border-ink px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink transition hover:bg-ink hover:text-bone disabled:opacity-40"
                  >
                    ⏸ Pertahankan semua konflik
                  </button>
                  <span className="text-[10px] text-muted">({conflictCount} konflik belum diputuskan — tetap bisa diubah per baris)</span>
                </div>
                <p className="text-xs leading-relaxed text-ink/70">
                  Klik baris untuk membuka detail per kolom (nilai lama vs baru). Baris “Tidak ditemukan” dilewati
                  otomatis dan dilaporkan di ringkasan akhir.
                </p>
                <div className="max-h-[46vh] overflow-auto rounded-card border-2 border-pure">
                  <table className="w-full min-w-[860px] border-collapse text-left text-xs">
                    <thead className="sticky top-0 z-20">
                      <tr className="bg-hivis font-mono text-[10px] uppercase tracking-[0.14em] text-pure">
                        <th className="sticky left-0 z-30 border-r-2 border-pure bg-hivis px-3 py-2">Nama di Excel</th>
                        <th className="px-3 py-2">Karyawan di Sistem</th>
                        {mappedFields.map((f) => (
                          <th key={f.id} className="whitespace-nowrap px-3 py-2">
                            {f.label}
                          </th>
                        ))}
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it) => {
                        const st = rowState(it);
                        const notFound = it.name_status === 'not_found' && !it.employeeId;
                        return (
                          <tr
                            key={it.row_index}
                            onClick={() => !notFound && setDetailRow(it)}
                            className={`cursor-pointer border-t border-ink/30 hover:bg-buttery/25 ${notFound || it.skipped ? 'opacity-60' : ''}`}
                          >
                            <td className="sticky left-0 z-10 max-w-[180px] truncate border-r-2 border-pure bg-bone px-3 py-2 font-semibold text-ink" title={it.excel_name}>
                              {it.excel_name || '—'}
                            </td>
                            <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                              {notFound ? (
                                <span className="text-firecracker">❌ Tidak ditemukan</span>
                              ) : it.candidates.length > 0 ? (
                                <select
                                  value={it.employeeId ?? ''}
                                  onChange={(e) => chooseEmployee(it, e.target.value === '' ? null : Number(e.target.value))}
                                  className={selectCls}
                                >
                                  <option value="">— pilih manual —</option>
                                  {it.candidates.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.nama} ({c.score}%)
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span className="text-ink">✅ {it.employeeName}</span>
                              )}
                            </td>
                            {mappedFields.map((f) => {
                              const cell = it.cells.find((c) => c.field_id === f.id);
                              if (!cell || cell.status === 'empty') {
                                return (
                                  <td key={f.id} className="px-3 py-2 text-muted">
                                    —
                                  </td>
                                );
                              }
                              return (
                                <td key={f.id} className="px-3 py-2">
                                  <div className="space-y-1">
                                    {cellBadge(cell, it.decisions?.[f.id])}
                                    <div className="max-w-[160px] truncate text-ink/80" title={`${cell.current_label ? `Lama: ${cell.current_label}\n` : ''}Baru: ${cell.excel_value}`}>
                                      {cell.status === 'conflict' || (cell.status === 'unmapped' && cell.current_label)
                                        ? `${cell.current_label} → ${cell.excel_value}`
                                        : cell.excel_value}
                                    </div>
                                  </div>
                                </td>
                              );
                            })}
                            <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                              <div className="flex flex-col items-start gap-1">
                                {notFound ? (
                                  <Badge tone="gray">❌ Tidak ditemukan</Badge>
                                ) : it.skipped ? (
                                  <Badge tone="gray">⏭ Dilewati</Badge>
                                ) : st === 'ready' ? (
                                  <Badge tone="green">✅ Siap</Badge>
                                ) : (
                                  <Badge tone="amber">⚠ Perlu keputusan</Badge>
                                )}
                                {!notFound && (
                                  <button
                                    onClick={() => updateItem(it.row_index, { skipped: !it.skipped })}
                                    className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted underline-offset-2 transition hover:text-magenta hover:underline"
                                  >
                                    {it.skipped ? 'Batalkan lewati' : 'Lewati baris ini'}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ===== Langkah 4: Ringkasan ===== */}
            {step === 'summary' && summary && (
              <div className="space-y-4">
                {summary.invalid_cells > 0 && (
                  <div className="rounded-card border-2 border-firecracker bg-bubblegum px-4 py-3 text-sm font-semibold text-ink">
                    ⚠️ {summary.invalid_cells} sel gagal disimpan (nilai tidak valid atau opsi sudah berubah) —
                    baris terkait dilewati. Periksa kembali data tersebut lalu ulangi proses untuk baris yang belum terisi.
                  </div>
                )}
                <div className="rounded-card border-2 border-pure bg-bubblegum p-[17px] text-center">
                  <div className="font-display text-[48px] leading-[0.9] text-ink">{summary.applied_rows}</div>
                  <div className="mt-2 font-mono text-[12px] font-semibold uppercase tracking-[0.14em] text-ink/70">Baris diterapkan</div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-card border border-ink bg-bone p-4 text-center">
                    <div className="font-display text-2xl leading-[0.9] text-ink">{summary.filled}</div>
                    <div className="mt-1 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Field terisi otomatis</div>
                  </div>
                  <div className="rounded-card border border-ink bg-bone p-4 text-center">
                    <div className="font-display text-2xl leading-[0.9] text-ink">{summary.updated}</div>
                    <div className="mt-1 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Konflik ditimpa</div>
                  </div>
                  {summary.written_cells != null && (
                    <div className="rounded-card border border-ink bg-bone p-4 text-center sm:col-span-2 lg:col-span-4">
                      <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                        Total {summary.written_cells} sel benar-benar tersimpan ke database
                        {summary.failed_rows > 0 ? ` • ${summary.failed_rows} baris mengandung sel gagal` : ''}
                      </div>
                    </div>
                  )}
                  <div className="rounded-card border border-ink bg-bone p-4 text-center">
                    <div className="font-display text-2xl leading-[0.9] text-ink">{summary.kept}</div>
                    <div className="mt-1 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Konflik dipertahankan</div>
                  </div>
                  <div className="rounded-card border border-ink bg-bone p-4 text-center">
                    <div className="font-display text-2xl leading-[0.9] text-ink">{(summary.new_options || []).length}</div>
                    <div className="mt-1 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Opsi baru ditambahkan</div>
                  </div>
                </div>
                {(summary.new_options || []).length > 0 && (
                  <div className="rounded-card border-2 border-buttery bg-buttery/25 px-4 py-3 font-mono text-xs leading-relaxed text-ink">
                    Opsi baru ditambahkan ke akhir hierarki kolom masing-masing:{' '}
                    <b>{summary.new_options.map((o) => `${o.label} (${o.field_label})`).join(', ')}</b>. Atur urutannya
                    lewat Kelola Kolom → Kelola Opsi.
                  </div>
                )}
                <p className="text-xs text-ink/70">
                  {summary.not_found} nama tidak ditemukan dan {summary.skipped_rows} baris dilewati — tidak
                  menghentikan baris lain. Nama Lengkap tidak pernah diubah oleh proses ini.
                </p>
              </div>
            )}
          </div>

          {/* Footer tombol */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink px-6 py-4">
            <div className="text-xs text-muted">
              {step === 'preview' &&
                (pendingCount > 0
                  ? `Selesaikan ${pendingCount} baris yang masih perlu keputusan (atau lewati) untuk mengaktifkan tombol Terapkan.`
                  : `${readyCount} baris siap diterapkan.`)}
              {step === 'mapping' && 'Pastikan pemetaan kolom sudah benar sebelum melanjutkan.'}
              {step === 'summary' && 'Data sudah tersimpan ke database.'}
            </div>
            <div className="flex gap-3">
              {step === 'mapping' && (
                <button onClick={() => setStep('upload')} className={btnGhost} disabled={matching}>
                  ← Ganti File
                </button>
              )}
              {step === 'preview' && (
                <button onClick={() => setStep('mapping')} className={btnGhost} disabled={applying}>
                  ← Ubah Pemetaan
                </button>
              )}
              {step !== 'summary' && (
                <button onClick={onClose} className={btnGhost} disabled={busy || matching || applying}>
                  Batal
                </button>
              )}
              {step === 'mapping' && (
                <button onClick={doMatch} className={btnRose} disabled={matching || nameCol < 0}>
                  {matching ? 'Mencocokkan…' : 'Cocokkan Sekarang'}
                </button>
              )}
              {step === 'preview' && (
                <button
                  onClick={doApply}
                  className={btnRose}
                  disabled={applying || pendingCount > 0 || readyCount === 0}
                  title={pendingCount > 0 ? 'Masih ada baris yang perlu keputusan atau dilewati.' : 'Simpan hasil ke database'}
                >
                  {applying ? 'Menyimpan…' : `Terapkan (${readyCount})`}
                </button>
              )}
              {step === 'summary' && (
                <button onClick={onClose} className={btnRose}>
                  Selesai
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ===== Modal detail per baris (nilai lama vs baru, keputusan per sel) ===== */}
      {detailRow && (
        <Modal title={`Detail — ${detailRow.excel_name}`} onClose={() => setDetailRow(null)} wide>
          <div className="space-y-3">
            {detailRow.candidates.length > 0 && (
              <div className="rounded-card border border-ink/40 bg-lilacshadow/10 p-3">
                <div className="mb-1 font-mono text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">Karyawan di Sistem</div>
                <select
                  value={detailRow.employeeId ?? ''}
                  onChange={(e) => chooseEmployee(detailRow, e.target.value === '' ? null : Number(e.target.value))}
                  className={selectCls}
                >
                  <option value="">— pilih manual —</option>
                  {detailRow.candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nama} ({c.score}%)
                    </option>
                  ))}
                </select>
              </div>
            )}
            {detailRow.cells.map((cell) => {
              const dec = detailRow.decisions?.[cell.field_id];
              const setDec = (d) =>
                updateItem(detailRow.row_index, {
                  decisions: d ? { ...detailRow.decisions, [cell.field_id]: d } : omitKey(detailRow.decisions, cell.field_id),
                });
              return (
                <div key={cell.field_id} className="rounded-card border border-ink/40 bg-bone p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-ink">
                      {cell.field_label} <span className="text-xs font-normal text-muted">({TYPE_LABEL[cell.field_type]})</span>
                    </div>
                    {cellBadge(cell, dec)}
                  </div>
                  {cell.status === 'empty' ? (
                    <p className="text-xs text-muted">Kolom Excel kosong — tidak mengubah apa pun.</p>
                  ) : cell.status === 'match' ? (
                    <p className="text-xs text-ink/70">
                      Sudah terisi di sistem dengan nilai yang sama: <b>{cell.current_label || cell.excel_value}</b>
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="rounded-card border border-firecracker/40 bg-bubblegum/60 px-3 py-2">
                          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Data di Sistem (lama)</div>
                          <div className="text-sm text-ink">{cell.current_label || <span className="text-muted">(kosong)</span>}</div>
                        </div>
                        <div className="rounded-card border border-matcha bg-matcha/40 px-3 py-2">
                          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Dari File (baru)</div>
                          <div className="text-sm text-ink">{cell.excel_value}</div>
                        </div>
                      </div>
                      {(cell.status === 'conflict' || cell.status === 'invalid') && (
                        <div className="flex flex-wrap gap-2">
                          {cell.status === 'conflict' && (
                            <>
                              <button
                                onClick={() => setDec({ action: 'set' })}
                                className={dec?.action === 'set' ? 'rounded-pill bg-magenta px-4 py-1.5 font-grotesk text-xs font-bold uppercase tracking-[0.05em] text-bone' : btnGhost}
                              >
                                ⏫ Timpa dengan data baru
                              </button>
                              <button
                                onClick={() => setDec({ action: 'keep' })}
                                className={dec?.action === 'keep' ? 'rounded-pill bg-ink px-4 py-1.5 font-grotesk text-xs font-bold uppercase tracking-[0.05em] text-bone' : btnGhost}
                              >
                                ⏸ Pertahankan data lama
                              </button>
                            </>
                          )}
                          {cell.status === 'invalid' && (
                            <button
                              onClick={() => setDec({ action: 'keep' })}
                              className={dec?.action === 'keep' ? 'rounded-pill bg-ink px-4 py-1.5 font-grotesk text-xs font-bold uppercase tracking-[0.05em] text-bone' : btnGhost}
                            >
                              ⏸ Pertahankan data lama
                            </button>
                          )}
                        </div>
                      )}
                      {cell.status === 'unmapped' && (
                        <div className="space-y-2">
                          <select
                            value={dec?.action === 'set' ? dec.value ?? '' : ''}
                            onChange={(e) =>
                              setDec(e.target.value === '' ? null : { action: 'set', value: e.target.value })
                            }
                            className={selectCls}
                          >
                            <option value="">— pilih opsi yang ada —</option>
                            {(fields.find((f) => f.id === cell.field_id)?.options || []).map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => setDec({ action: 'new_option', new_option_label: dec?.new_option_label || cell.excel_value })}
                              className={dec?.action === 'new_option' ? 'rounded-pill bg-magenta px-4 py-1.5 font-grotesk text-xs font-bold uppercase tracking-[0.05em] text-bone' : btnGhost}
                            >
                              ➕ Tambahkan sebagai opsi baru
                            </button>
                            {dec?.action === 'new_option' && (
                              <input
                                type="text"
                                value={dec.new_option_label || ''}
                                onChange={(e) => setDec({ action: 'new_option', new_option_label: e.target.value })}
                                placeholder="Label opsi baru"
                                className="min-w-0 flex-1 rounded-card border border-magenta bg-bone px-3 py-1.5 text-sm text-ink focus:border-magenta focus:outline-none"
                              />
                            )}
                            <button
                              onClick={() => setDec({ action: 'keep' })}
                              className={dec?.action === 'keep' ? 'rounded-pill bg-ink px-4 py-1.5 font-grotesk text-xs font-bold uppercase tracking-[0.05em] text-bone' : btnGhost}
                            >
                              ⏸ Pertahankan data lama
                            </button>
                          </div>
                          <p className="text-[10px] text-muted">Opsi baru masuk ke akhir hierarki — atur posisinya lewat Kelola Opsi.</p>
                        </div>
                      )}
                      {cell.status === 'fill' && dec?.action === 'keep' && (
                        <button onClick={() => setDec(null)} className={btnGhost}>
                          ↩ Kirim ulang (isi otomatis)
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {!detailRow.skipped && (
              <button
                onClick={() => {
                  updateItem(detailRow.row_index, { skipped: !detailRow.skipped });
                  setDetailRow(null);
                }}
                className={btnGhost}
              >
                ⏭ Lewati baris ini
              </button>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}

function omitKey(obj, key) {
  const next = { ...(obj || {}) };
  delete next[key];
  return next;
}
