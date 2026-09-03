import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
import StatCards from './components/StatCards';
import Pagination from './components/Pagination';
import EmployeeFormModal from './components/EmployeeFormModal';
import FieldManagerModal from './components/FieldManagerModal';
import ExportModal from './components/ExportModal';
import ConfirmDialog from './components/ConfirmDialog';

const PER_PAGE = 20;

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
  const [confirm, setConfirm] = useState(null);

  // Filter baris berdasarkan kolom bertipe dropdown: { idKolom: nilai }
  const [filters, setFilters] = useState({});
  const dropdownFields = fields.filter((f) => f.field_type === 'dropdown');
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
    const allowed = new Set(dropdownFields.map((f) => String(f.id)));
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

  // Muat daftar personel
  const loadEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getEmployees({
        search: debouncedSearch,
        page,
        per_page: PER_PAGE,
        filters: Object.keys(filters).length > 0 ? filters : undefined,
      });
      setEmployees(data);
    } catch (e) {
      showToast(e.message);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page, filters]);

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

  // ===== Render =====
  return (
    <div className="min-h-screen">
      {/* Navigasi atas */}
      <header className="border-b border-white/10 bg-ink">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div>
            <div className="font-display text-xl font-bold uppercase tracking-widest text-cream">
              Sistem Pendataan Personel
            </div>
            <div className="text-[11px] uppercase tracking-wider text-muted">Sistem Internal</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setFieldManagerOpen(true)}
              className="rounded-full border border-cream/30 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-cream transition hover:bg-cream/10"
            >
              Kelola Kolom
            </button>
            <button
              onClick={() => setExportOpen(true)}
              className="rounded-full border border-cream/30 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-cream transition hover:bg-cream/10"
            >
              Export Excel
            </button>
            <button
              onClick={() => setEmployeeModal({ employee: null })}
              className="rounded-full bg-cream px-5 py-2 text-xs font-semibold uppercase tracking-wider text-ink transition hover:bg-cream/90"
            >
              + Tambah Personel
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
        <StatCards stats={stats} fieldsCount={fields.length} />

        {/* Tabel data */}
        <section className="overflow-hidden rounded-2xl border border-line bg-cream text-coal">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
            <h2 className="font-display text-lg font-bold uppercase tracking-wide">Data Personel</h2>
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama…"
                className="w-64 rounded-full border border-line bg-white py-2 pl-4 pr-4 text-sm text-coal transition focus:border-ink focus:outline-none"
              />
            </div>
          </div>

          {dropdownFields.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-t border-line px-6 py-3">
              <span className="mr-1 text-[10px] font-bold uppercase tracking-wider text-muted">
                Filter Dropdown:
              </span>
              {dropdownFields.map((f) => (
                <select
                  key={f.id}
                  value={filters[String(f.id)] ?? ''}
                  onChange={(e) => setDropdownFilter(String(f.id), e.target.value)}
                  title={`Filter kolom "${f.label}"`}
                  className="max-w-[240px] cursor-pointer rounded-full border border-line bg-white px-3 py-1.5 text-xs text-coal transition hover:border-ink/40 focus:border-ink focus:outline-none"
                >
                  <option value="">{f.label}: Semua</option>
                  {(f.options || []).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ))}
              {Object.keys(filters).length > 0 && (
                <button
                  onClick={() => setFilters({})}
                  className="rounded-full border border-clay/40 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-clay transition hover:bg-clay/10"
                >
                  ✕ Reset Filter
                </button>
              )}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-y border-line bg-cream">
                  <th className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-muted">Nama Lengkap</th>
                  {fields.map((f) => (
                    <th
                      key={f.id}
                      className="whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted"
                    >
                      {f.label}
                    </th>
                  ))}
                  <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wider text-muted">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={fields.length + 2} className="px-6 py-10 text-center text-sm text-muted">
                      Memuat data…
                    </td>
                  </tr>
                )}
                {!loading && employees.data.length === 0 && (
                  <tr>
                    <td colSpan={fields.length + 2} className="px-6 py-10 text-center text-sm text-muted">
                      {debouncedSearch || Object.keys(filters).length > 0
                        ? 'Tidak ada personel yang cocok dengan pencarian/filter.'
                        : 'Belum ada data personel. Klik "+ Tambah Personel" untuk mulai.'}
                    </td>
                  </tr>
                )}
                {!loading &&
                  employees.data.map((emp) => (
                    <tr key={emp.id} className="border-t border-line transition hover:bg-white/60">
                      <td className="px-6 py-3 font-semibold text-coal">{emp.nama_lengkap}</td>
                      {fields.map((f) => {
                        const val = emp.biodata?.[String(f.id)];
                        return (
                          <td key={f.id} className="whitespace-nowrap px-4 py-3 text-coal/80">
                            {val !== null && val !== undefined && val !== '' ? val : <span className="text-line">—</span>}
                          </td>
                        );
                      })}
                      <td className="whitespace-nowrap px-6 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setEmployeeModal({ employee: emp })}
                            className="rounded-full border border-line px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-coal transition hover:bg-line/50"
                          >
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
                            className="rounded-full border border-clay/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-clay transition hover:bg-clay/10"
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
      {confirm &&
        (confirm.action === 'employee' ? (
          <ConfirmDialog
            title={confirm.title}
            message={confirm.message}
            onConfirm={handleDeleteEmployee}
            onClose={() => setConfirm(null)}
          />
        ) : null)}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-cream px-5 py-2 text-sm font-medium text-coal shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}