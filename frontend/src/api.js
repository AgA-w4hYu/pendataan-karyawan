async function request(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    throw new Error(data?.error || `Terjadi kesalahan (${res.status})`);
  }
  return data;
}

export const api = {
  getFields: () => request('/api/fields'),
  createField: (payload) => request('/api/fields', { method: 'POST', body: JSON.stringify(payload) }),
  updateField: (id, payload) => request(`/api/fields/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteField: (id) => request(`/api/fields/${id}`, { method: 'DELETE' }),
  reorderFields: (ids) => request('/api/fields/reorder', { method: 'POST', body: JSON.stringify({ ids }) }),

  getEmployees: (params) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v === '' || v == null) return;
      // Objek (mis. filter dropdown { idField: nilai }) diubah jadi JSON string
      qs.set(k, typeof v === 'object' ? JSON.stringify(v) : v);
    });
    return request(`/api/employees?${qs.toString()}`);
  },
  getEmployee: (id) => request(`/api/employees/${id}`),
  createEmployee: (payload) => request('/api/employees', { method: 'POST', body: JSON.stringify(payload) }),
  updateEmployee: (id, payload) => request(`/api/employees/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteEmployee: (id) => request(`/api/employees/${id}`, { method: 'DELETE' }),

  getStats: () => request('/api/stats'),

  // ===== Isi Biodata dari File (AI) =====
  // File .doc dikirim ke server utk diparse (Word binary); server membalas
  // { kind: 'doc', headers, rows } atau { kind: 'browser' } utk format lain.
  parseImportDoc: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return fetch('/api/biodata-import/parse', { method: 'POST', body: fd }).then(async (res) => {
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `Terjadi kesalahan (${res.status})`);
      return data;
    });
  },
  matchBiodata: (payload) => request('/api/biodata-import/match', { method: 'POST', body: JSON.stringify(payload) }),
  applyBiodata: (payload) => request('/api/biodata-import/apply', { method: 'POST', body: JSON.stringify(payload) }),
  exportUrl: (fields, filters = {}) => {
    const qs = new URLSearchParams({ fields: fields.join(',') });
    const active = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '' && v != null));
    if (Object.keys(active).length > 0) qs.set('filters', JSON.stringify(active));
    return `/api/export?${qs.toString()}`;
  },
};