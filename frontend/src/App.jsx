import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
import StatCards from './components/StatCards';
import Pagination from './components/Pagination';
import EmployeeFormModal from './components/EmployeeFormModal';
import FieldManagerModal from './components/FieldManagerModal';
import ExportModal from './components/ExportModal';
import BiodataImportModal from './components/BiodataImportModal';
import ConfirmDialog from './components/ConfirmDialog';

const PER_PAGE = 20;

// ===== Kelas tombol tema Flying Papers (PRD Section 6) =====
// Pill 100px; HANYA tombol utama yang fill solid (Bone White); sisanya outline.
const btnSecondary =
  'rounded-pill border-2 border-hivis px-4 py-2 font-grotesk text-xs font-bold uppercase tracking-[0.05em] text-hivis transition hover:bg-hivis hover:text-pure';
const btnEdit =
  'rounded-pill border border-ink bg-bone px-3 py-1 font-grotesk text-[11px] font-bold uppercase tracking-[0.05em] text-ink transition hover:bg-ink hover:text-bone';
const btnDelete =
  'rounded-pill border border-firecracker bg-bone px-3 py-1 font-grotesk text-[11px] font-bold uppercase tracking-[0.05em] text-firecracker transition hover:bg-firecracker hover:text-bone';
// Input & select: kotak radius 6px (pill dikhususkan untuk tombol & tag saja).
const inputCls =
  'rounded-card border border-ink bg-bone px-3 py-2 text-sm text-ink transition focus:border-magenta focus:outline-none';

export default function App() {
  const [fields, setFields] = useState([]);
  const [employees, setEmployees] = useState({ data: [], total: 0, page: 1, total_pages: 1 });
  const [stats, setStats] = useState(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');

  const [employeeModal, setEmployeeModal] = useState(null);
  const [fieldManagerOpen, setFieldManagerOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [biodataImportOpen, setBiodataImportOpen] = useState(false);
  const [confirm, setConfirm] = useState(null);

  // Filter baris berdasarkan kolom bertipe dropdown / dropdown berurutan: { idKolom: nilai }
  // (dropdown: label teks; ordered_select: id opsi hierarki)
  const [filters, setFilters] = useState({});
  const dropdownFields = fields.filter((f) => f.field_type === 'dropdown' || f.field_type === 'ordered_select');

  // Sort tabel: hanya kolom Dropdown Berurutan yang bisa diurutkan (by hierarki).
  const [sortField, setSortField] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const toggleSort = (fieldId) => {
    if (sortField === fieldId) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(fieldId);
      setSortDir('asc');
    }
    setPage(1);
  };

  const setDropdownFilter = (key, value) => {
    setFilters((prev) => {
      const next = { ...prev };
      if (value === '') delete next[key];
      else next[key] = value;
      return next;
    });
  };

  // Buang filter kolom yang sudah dihapus / bukan dropdown lagi
  useEffect(() => {
    const allowed = new Set(fields.filter((f) => f.field_type === 'dropdown' || f.field_type === 'ordered_select').map((f) => String(f.id)));
    setFilters((prev) => {
      let changed = false;
      const next = {};
      for (const [k, v] of Object.entries(prev)) {
        if (allowed.has(k) && v !== '') next[k] = v;
        else changed = true;
      }
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields]);

  const toastTimer = useRef(null);
  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3500);
  };

  // Muat field + statistik awal
  useEffect(() => {
    api
      .getFields()
      .then(setFields)
      .catch((e) => showToast(e.message));
    api
      .getStats()
      .then(setStats)
      .catch(() => {});
  }, []);

  // Debounce pencarian
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, JSON.stringify(filters)]);

  // Buang sort kolom yang bukan dropdown berurutan (mis. tipe diubah/hapus)
  useEffect(() => {
    const sortable = new Set(fields.filter((f) => f.field_type === 'ordered_select').map((f) => f.id));
    if (sortField !== null && !sortable.has(sortField)) {
      setSortField(null);
      setSortDir('asc');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields]);

  // Muat daftar personel
  const loadEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getEmployees({
        search: debouncedSearch,
        page,
        per_page: PER_PAGE,
        filters: Object.keys(filters).length > 0 ? filters : undefined,
        sort_field: sortField ?? undefined,
        sort_dir: sortField != null ? sortDir : undefined,
      });
      setEmployees(data);
    } catch (e) {
      showToast(e.message);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page, filters, sortField, sortDir]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const refreshAll = useCallback(() => {
    loadEmployees();
    api
      .getStats()
      .then(setStats)
      .catch(() => {});
  }, [loadEmployees]);

  // ===== Personel =====
  const handleSaveEmployee = async (payload) => {
    if (employeeModal?.employee) {
      await api.updateEmployee(employeeModal.employee.id, payload);
      showToast('Data personel diperbarui.');
    } else {
      await api.createEmployee(payload);
      showToast('Personel baru ditambahkan.');
    }
    setEmployeeModal(null);
    refreshAll();
  };

  const handleDeleteEmployee = async () => {
    try {
      await api.deleteEmployee(confirm.id);
      showToast('Personel dihapus.');
      setConfirm(null);
      refreshAll();
    } catch (e) {
      showToast(e.message);
      setConfirm(null);
    }
  };

  // ===== Kolom biodata =====
  const handleCreateField = async (payload) => {
    const updated = await api.createField(payload);
    setFields(updated);
    showToast('Kolom biodata ditambahkan.');
    refreshAll();
  };

  const handleUpdateField = async (id, payload) => {
    const updated = await api.updateField(id, payload);
    setFields(updated);
    showToast('Kolom biodata diperbarui.');
    refreshAll();
  };

  const handleDeleteField = async (id) => {
    await api.deleteField(id);
    const updated = await api.getFields();
    setFields(updated);
    showToast('Kolom biodata dihapus.');
    refreshAll();
  };

  const handleReorderFields = async (ids) => {
    try {
      setFields(await api.reorderFields(ids));
    } catch (e) {
      showToast(e.message);
    }
  };

  // Setelah import biodata: opsi baru bisa saja dibuat → muat ulang fields.
  // Toast harus jujur (PRD Section 4): sukses hanya bila backend melaporkan
  // operasi tulis nyata; kegagalan (total/sebagian) diberi tahu eksplisit.
  const handleBiodataApplied = useCallback(
    async (res) => {
      const r = res || {};
      const wrote = (r.written_cells ?? 0) > 0 || (r.new_options || []).length > 0;
      const failed = (r.invalid_cells ?? 0) > 0 || (r.failed_rows ?? 0) > 0;
      if (!wrote) {
        showToast('Tidak ada data yang berubah di database — periksa keputusan di layar preview.');
      } else if (failed) {
        showToast(`Tersimpan sebagian: ${r.invalid_cells} sel gagal disimpan. Cek ringkasan di layar import.`);
      } else {
        showToast('Biodata berhasil diperbarui dari file.');
      }
      try {
        setFields(await api.getFields());
      } catch {
        // dibiarkan: refresh tabel tetap jalan di bawah
      }
      refreshAll(); // tabel utama + statistik langsung dimuat ulang agar terlihat hasilnya
    },
    [refreshAll],
  );

  // ===== Render =====
  return (
    <div className="min-h-screen">
      {/* Navigasi atas — tetap di atas Dusk Violet (PRD Section 6) */}
      <header className="border-b-2 border-pure">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-6">
          <div>
            {/* Nama app: Archivo Black, Hi-Vis Yellow, ~32px */}
            <h1
              className="font-display text-3xl uppercase leading-[0.9] text-hivis sm:text-[32px]"
              style={{ letterSpacing: '0.01em' }}
            >
              Sistem Pendataan Personel
            </h1>
            <div className="mt-1 font-mono text-[12px] uppercase tracking-[0.18em] text-bone">Sistem Internal</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setFieldManagerOpen(true)} className={btnSecondary}>
              Kelola Kolom
            </button>
            <button onClick={() => setExportOpen(true)} className={btnSecondary}>
              Export Excel
            </button>
            <button
              onClick={() => setBiodataImportOpen(true)}
              className={btnSecondary}
              title="Upload file daftar personel, sistem mencocokkan & mengisi kolom biodata apa pun"
            >
              ⬆ Isi Biodata dari File (AI)
            </button>
            {/* Satu-satunya tombol fill solid: Gate Pill Button Bone White */}
            <button
              onClick={() => setEmployeeModal({ employee: null })}
              className="rounded-pill bg-bone px-5 py-2 font-grotesk text-xs font-bold uppercase tracking-[0.05em] text-pure transition hover:bg-hivis"
            >
              + Tambah Personel
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-10 px-4 py-10 sm:px-6">
        <StatCards stats={stats} fieldsCount={fields.length} />

        {/* Tabel data */}
        <section className="overflow-hidden rounded-card border-2 border-pure bg-bone text-ink">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
            <h2 className="font-display text-lg uppercase leading-[0.9] text-ink">Data Personel</h2>
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama…"
                className={`${inputCls} w-64`}
              />
            </div>
          </div>

          {dropdownFields.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-t border-ink px-6 py-3">
              <span className="mr-1 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                Filter Dropdown:
              </span>
              {dropdownFields.map((f) => (
                <select
                  key={f.id}
                  value={filters[String(f.id)] ?? ''}
                  onChange={(e) => setDropdownFilter(String(f.id), e.target.value)}
                  title={`Filter kolom "${f.label}"`}
                  className="max-w-[240px] cursor-pointer rounded-card border border-ink bg-bone px-3 py-1.5 font-mono text-[12px] uppercase tracking-wide text-ink transition hover:border-magenta focus:border-magenta focus:outline-none"
                >
                  <option value="">{f.label}: Semua</option>
                  {(f.options || []).map((opt) =>
                    f.field_type === 'ordered_select' ? (
                      // Urutan opsi = urutan hierarki yang diatur admin
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
              ))}
              {Object.keys(filters).length > 0 && (
                <button
                  onClick={() => setFilters({})}
                  className="rounded-pill border border-firecracker px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-firecracker transition hover:bg-firecracker hover:text-bone"
                >
                  ✕ Reset Filter
                </button>
              )}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                {/* Header baris: Hi-Vis Yellow solid — elemen paling menonjol di layar data */}
                <tr className="border-y-2 border-pure bg-hivis">
                  <th className="sticky left-0 z-20 whitespace-nowrap border-r-2 border-pure bg-hivis px-6 py-3 text-left font-mono text-[12px] font-bold uppercase tracking-[0.14em] text-pure">
                    Nama Lengkap
                  </th>
                  {fields.map((f) =>
                    f.field_type === 'ordered_select' ? (
                      // Kolom Dropdown Berurutan: header bisa diklik utk sort by hierarki
                      <th key={f.id} className="whitespace-nowrap border-r border-pure/30 px-4 py-3">
                        <button
                          onClick={() => toggleSort(f.id)}
                          className="flex items-center gap-1 font-mono text-[12px] font-bold uppercase tracking-[0.14em] text-pure transition hover:text-magenta"
                          title={`Urutkan "${f.label}" sesuai hierarki`}
                        >
                          {f.label}
                          <span className={sortField === f.id ? 'text-magenta' : 'text-pure/40'}>
                            {sortField === f.id ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
                          </span>
                        </button>
                      </th>
                    ) : (
                      <th
                        key={f.id}
                        className="whitespace-nowrap border-r border-pure/30 px-4 py-3 font-mono text-[12px] font-bold uppercase tracking-[0.14em] text-pure"
                      >
                        {f.label}
                      </th>
                    ),
                  )}
                  <th className="sticky right-0 z-20 border-l-2 border-pure bg-hivis px-6 py-3 text-right font-mono text-[12px] font-bold uppercase tracking-[0.14em] text-pure">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={fields.length + 2} className="bg-bone px-6 py-10 text-center text-sm text-muted">
                      Memuat data…
                    </td>
                  </tr>
                )}
                {!loading && employees.data.length === 0 && (
                  <tr>
                    <td colSpan={fields.length + 2} className="bg-bone px-6 py-10 text-center text-sm text-muted">
                      {debouncedSearch || Object.keys(filters).length > 0
                        ? 'Tidak ada personel yang cocok dengan pencarian/filter.'
                        : 'Belum ada data personel. Klik "+ Tambah Personel" untuk mulai.'}
                    </td>
                  </tr>
                )}
                {!loading &&
                  employees.data.map((emp) => (
                    <tr key={emp.id} className="group border-b border-ink/25 transition hover:bg-buttery/25">
                      <td className="sticky left-0 z-20 whitespace-nowrap border-r-2 border-pure bg-bone px-6 py-3 font-semibold text-ink group-hover:bg-[#F1E4CE]">
                        {emp.nama_lengkap}
                      </td>
                      {fields.map((f) => {
                        const val = emp.biodata?.[String(f.id)];
                        if (f.field_type === 'ordered_select') {
                          // Nilai tersimpan sebagai id opsi. Nilai lama (teks bebas
                          // sebelum tipe diubah) tidak ditemukan di daftar opsi →
                          // tampilkan badge "Perlu diisi ulang" (PRD Section 6).
                          const opt = (f.options || []).find((o) => String(o.id) === String(val));
                          if (val !== null && val !== undefined && val !== '' && !opt) {
                            return (
                              <td key={f.id} className="whitespace-nowrap px-4 py-3">
                                <span
                                  title={`Nilai lama "${val}" belum dipetakan ke opsi baru — isi ulang lewat form edit personel.`}
                                  className="inline-flex items-center gap-1 rounded-pill border border-firecracker bg-bone px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-firecracker"
                                >
                                  ⚠ Perlu diisi ulang
                                </span>
                              </td>
                            );
                          }
                          return (
                            <td key={f.id} className="whitespace-nowrap px-4 py-3 text-ink/80">
                              {opt ? (
                                opt.label
                              ) : (
                                <span className="text-muted/50">—</span>
                              )}
                            </td>
                          );
                        }
                        return (
                          <td key={f.id} className="whitespace-nowrap px-4 py-3 text-ink/80">
                            {val !== null && val !== undefined && val !== '' ? val : <span className="text-muted/50">—</span>}
                          </td>
                        );
                      })}
                      <td className="sticky right-0 z-20 whitespace-nowrap border-l-2 border-pure bg-bone px-6 py-3 text-right group-hover:bg-[#F1E4CE]">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setEmployeeModal({ employee: emp })} className={btnEdit}>
                            Edit
                          </button>
                          <button
                            onClick={() =>
                              setConfirm({
                                title: 'Hapus Personel',
                                message: `Yakin hapus "${emp.nama_lengkap}"? Seluruh data biodatanya akan terhapus permanen dan tidak bisa dikembalikan.`,
                                id: emp.id,
                                action: 'employee',
                              })
                            }
                            className={btnDelete}
                          >
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={employees.page}
            totalPages={employees.total_pages}
            total={employees.total}
            perPage={employees.per_page}
            onPage={setPage}
          />
        </section>
      </main>

      {/* Modal & dialog */}
      {employeeModal && (
        <EmployeeFormModal
          fields={fields}
          employee={employeeModal.employee}
          onSave={handleSaveEmployee}
          onClose={() => setEmployeeModal(null)}
        />
      )}
      {fieldManagerOpen && (
        <FieldManagerModal
          fields={fields}
          onClose={() => setFieldManagerOpen(false)}
          onCreate={handleCreateField}
          onUpdate={handleUpdateField}
          onDelete={handleDeleteField}
          onReorder={handleReorderFields}
        />
      )}
      {exportOpen && (
        <ExportModal fields={fields} initialFilters={filters} onClose={() => setExportOpen(false)} />
      )}
      {biodataImportOpen && (
        <BiodataImportModal onApplied={handleBiodataApplied} onClose={() => setBiodataImportOpen(false)} />
      )}
      {confirm &&
        (confirm.action === 'employee' ? (
          <ConfirmDialog
            title={confirm.title}
            message={confirm.message}
            onConfirm={handleDeleteEmployee}
            onClose={() => setConfirm(null)}
          />
        ) : null)}

      {/* Toast — Dusk Violet pill, Bone text; tanpa shadow (PRD: no shadow) */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-pill border-2 border-pure bg-dusk px-5 py-2 text-sm font-semibold text-bone">
          {toast}
        </div>
      )}
    </div>
  );
}
