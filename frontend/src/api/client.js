export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message || `Request failed (${status})`);
    this.status = status;
    this.body = body;
  }
}

async function request(path, { method = 'GET', body, signal } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    signal,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON body */ }
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

/** Builds a query string; arrays become repeated keys, empty values are skipped. */
export function toQuery(params) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '' || v === false) continue;
    if (Array.isArray(v)) v.forEach((x) => q.append(k, String(x)));
    else q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

export const api = {
  meta: (signal) => request('/meta', { signal }),
  recommend: (criteria, signal) => request('/recommendations', { method: 'POST', body: criteria, signal }),
  search: (params, signal) => request(`/phones${toQuery(params)}`, { signal }),
  suggest: (q, signal) => request(`/phones/suggest${toQuery({ q })}`, { signal }),
  phone: (idOrSlug, signal) => request(`/phones/${encodeURIComponent(idOrSlug)}`, { signal }),
  compare: (ids, signal) => request(`/compare${toQuery({ ids: ids.join(',') })}`, { signal }),
};
