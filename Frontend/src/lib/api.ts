// API base always uses relative path — Vite dev proxy and production both route /api correctly.
const API_BASE = "/api";
const REQUEST_TIMEOUT_MS = 15_000;

function _authHeaders(): Record<string, string> {
  try {
    const stored = localStorage.getItem("scc_user");
    if (stored) {
      const user = JSON.parse(stored) as { email?: string; role?: string };
      return {
        "X-User-Email": user.email ?? "",
        "X-User-Role": user.role ?? "",
      };
    }
  } catch { /* ignore */ }
  return {};
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ..._authHeaders(), ...options?.headers },
      ...options,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { detail?: string };
      throw new Error(body.detail ?? `Request failed: ${res.status}`);
    }

    return res.json() as Promise<T>;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Request timed out. Please try again.");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ── Shared response types ────────────────────────────────────────────────────

export interface UserResponse {
  user_id: string;
  display_name: string;
  email: string;
  role: string;
  status: string;
  phone?: string | null;
  company_slug?: string | null;
  supplier_slug?: string | null;
}

export interface AdminUser {
  user_id: string;
  display_name: string;
  email: string;
  role: string;
  status: string;
  created_at?: string;
  phone?: string;
}

export interface ActivityEntry {
  timestamp: string;
  action: string;
  target: string;
  details: string;
}

// ── API client ───────────────────────────────────────────────────────────────

export const api = {
  auth: {
    login: (email: string, password: string, role: string) =>
      request<UserResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password, role }),
      }),
    signup: (name: string, email: string, password: string, role: string, phone = "") =>
      request<UserResponse>("/auth/signup", {
        method: "POST",
        body: JSON.stringify({ name, email, password, role, phone }),
      }),
  },

  companies: {
    list: () => request<Record<string, unknown>[]>("/companies/"),
    get: (id: string) => request<Record<string, unknown>>(`/companies/${encodeURIComponent(id)}`),
    getProfile: (slug: string) =>
      request<Record<string, unknown>>(`/companies/profile/${encodeURIComponent(slug)}`),
    updateProfile: (slug: string, data: Record<string, unknown>) =>
      request<{ status: string }>(`/companies/profile/${encodeURIComponent(slug)}`, {
        method: "PUT",
        body: JSON.stringify({ data }),
      }),
    updatePackages: (slug: string, payload: Record<string, unknown>) =>
      request<{ status: string }>(`/companies/profile/${encodeURIComponent(slug)}/packages`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
  },

  suppliers: {
    list: () => request<Record<string, unknown>[]>("/suppliers/"),
    get: (id: string) => request<Record<string, unknown>>(`/suppliers/${encodeURIComponent(id)}`),
    getProfile: (slug: string) =>
      request<Record<string, unknown>>(`/suppliers/profile/${encodeURIComponent(slug)}`),
    updateProfile: (slug: string, data: Record<string, unknown>) =>
      request<{ status: string }>(`/suppliers/profile/${encodeURIComponent(slug)}`, {
        method: "PUT",
        body: JSON.stringify({ data }),
      }),
    updateMaterials: (slug: string, materials: Record<string, unknown>[]) =>
      request<{ status: string }>(`/suppliers/profile/${encodeURIComponent(slug)}/materials`, {
        method: "PUT",
        body: JSON.stringify({ materials }),
      }),
  },

  admin: {
    getUsers: () => request<AdminUser[]>("/admin/users"),
    getActivity: () => request<ActivityEntry[]>("/admin/activity"),
    updateUserStatus: (userId: string, status: string) =>
      request<{ status: string }>("/admin/users/status", {
        method: "PUT",
        body: JSON.stringify({ user_id: userId, status }),
      }),
    getStats: () => request<Record<string, unknown>>("/admin/stats"),
    getCompanies: () => request<Record<string, unknown>[]>("/admin/companies"),
    getSuppliers: () => request<Record<string, unknown>[]>("/admin/suppliers"),
  },

  ai: {
    chat: (messages: { role: string; content: string }[], userEmail = "") =>
      request<{ response: string; recommendations?: unknown[] }>("/ai/chat", {
        method: "POST",
        body: JSON.stringify({ messages, user_email: userEmail }),
      }),
  },

  upload: {
    image: async (file: File, entityName: string, imageType: "profile" | "dp", role: string = "company"): Promise<string> => {
      const form = new FormData();
      form.append("file", file);
      form.append("entity_name", entityName);
      form.append("image_type", imageType);
      form.append("role", role);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30_000);
      try {
        const res = await fetch(`${API_BASE}/upload/image`, {
          method: "POST",
          body: form,
          signal: controller.signal,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { detail?: string };
          throw new Error(body.detail ?? `Upload failed: ${res.status}`);
        }
        const data = await res.json() as { url: string };
        return data.url;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          throw new Error("Upload timed out. Please try again.");
        }
        throw err;
      } finally {
        clearTimeout(timeoutId);
      }
    },
    document: async (file: File, entityName: string, docType: string, role: string = "company"): Promise<string> => {
      const form = new FormData();
      form.append("file", file);
      form.append("entity_name", entityName);
      form.append("doc_type", docType);
      form.append("role", role);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30_000);
      try {
        const res = await fetch(`${API_BASE}/upload/document`, {
          method: "POST",
          body: form,
          signal: controller.signal,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { detail?: string };
          throw new Error(body.detail ?? `Upload failed: ${res.status}`);
        }
        const data = await res.json() as { url: string };
        return data.url;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          throw new Error("Upload timed out. Please try again.");
        }
        throw err;
      } finally {
        clearTimeout(timeoutId);
      }
    },
  },
};
