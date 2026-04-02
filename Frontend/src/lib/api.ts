const API_BASE = "http://localhost:8000/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed: ${res.status}`);
  }
  return res.json();
}

// --- Auth ---
export const api = {
  auth: {
    login: (email: string, password: string, role: string) =>
      request<any>("/auth/login", { method: "POST", body: JSON.stringify({ email, password, role }) }),
    signup: (name: string, email: string, password: string, role: string, phone = "") =>
      request<any>("/auth/signup", { method: "POST", body: JSON.stringify({ name, email, password, role, phone }) }),
  },

  // --- Companies ---
  companies: {
    list: () => request<any[]>("/companies/"),
    get: (id: string) => request<any>(`/companies/${encodeURIComponent(id)}`),
    getProfile: (slug: string) => request<any>(`/companies/profile/${encodeURIComponent(slug)}`),
    updateProfile: (slug: string, data: any) =>
      request<any>(`/companies/profile/${encodeURIComponent(slug)}`, { method: "PUT", body: JSON.stringify({ data }) }),
    updatePackages: (slug: string, payload: any) =>
      request<any>(`/companies/profile/${encodeURIComponent(slug)}/packages`, { method: "PUT", body: JSON.stringify(payload) }),
  },

  // --- Suppliers ---
  suppliers: {
    list: () => request<any[]>("/suppliers/"),
    get: (id: string) => request<any>(`/suppliers/${encodeURIComponent(id)}`),
    getProfile: (slug: string) => request<any>(`/suppliers/profile/${encodeURIComponent(slug)}`),
    updateProfile: (slug: string, data: any) =>
      request<any>(`/suppliers/profile/${encodeURIComponent(slug)}`, { method: "PUT", body: JSON.stringify({ data }) }),
    updateMaterials: (slug: string, materials: any[]) =>
      request<any>(`/suppliers/profile/${encodeURIComponent(slug)}/materials`, { method: "PUT", body: JSON.stringify({ materials }) }),
  },

  // --- Admin ---
  admin: {
    getUsers: () => request<any[]>("/admin/users"),
    getActivity: () => request<any[]>("/admin/activity"),
    updateUserStatus: (userId: string, status: string) =>
      request<any>("/admin/users/status", { method: "PUT", body: JSON.stringify({ user_id: userId, status }) }),
    getStats: () => request<any>("/admin/stats"),
    getCompanies: () => request<any[]>("/admin/companies"),
    getSuppliers: () => request<any[]>("/admin/suppliers"),
  },

  // --- AI ---
  ai: {
    chat: (messages: { role: string; content: string }[], userEmail = "") =>
      request<any>("/ai/chat", { method: "POST", body: JSON.stringify({ messages, user_email: userEmail }) }),
  },
};
