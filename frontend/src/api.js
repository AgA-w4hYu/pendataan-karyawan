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
      if (v !== '' && v != null) qs.set(k, v);
    });
    return request(`/api/employees?${qs.toString()}`);
  },
  getEmployee: (id) => request(`/api/employees/${id}`),
  createEmployee: (payload) => request('/api/employees', { method: 'POST', body: JSON.stringify(payload) }),
  updateEmployee: (id, payload) => request(`/api/employees/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteEmployee: (id) => request(`/api/employees/${id}`, { method: 'DELETE' }),

  getStats: () => request('/api/stats'),
  exportUrl: (fields) => `/api/export?fields=${fields.join(',')}`,
};