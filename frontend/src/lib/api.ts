// API base always uses relative path — Vite dev proxy and production both route /api correctly.
import { withEntityImage, withEntityImages } from "./entityImage";

export const API_BASE = "/api";
// Render's free plan spins the backend down when idle: the first request after
// a cold start can take 30-60s. A shorter timeout aborts that request and the
// UI shows a spurious "Request timed out" on the user's first action.
const REQUEST_TIMEOUT_MS = 60_000;

function _authHeaders(): Record<string, string> {
  try {
    const token = localStorage.getItem("scc_token");
    if (token) {
      return { Authorization: `Bearer ${token}` };
    }
    // Legacy fallback — will be removed in a future release
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
      if (res.status === 401) {
        // Token expired / invalid — clear auth state and redirect
        localStorage.removeItem("scc_token");
        localStorage.removeItem("scc_user");
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
      }
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
  access_token?: string;
  token_type?: string;
}

export interface AdminUser {
  id: string;
  name: string;
  display_name: string;
  email: string;
  role: string;
  status: string;
  joinDate?: string;
  phone?: string;
  user_id: string;
  created_at?: string;
}

export interface ActivityEntry {
  timestamp: string;
  action: string;
  target: string;
  details: string;
}

export interface Message {
  id: string;
  sender: string;
  sender_name: string;
  content: string;
  timestamp: string;
  read: boolean;
  status?: "sent" | "delivered" | "read";
  deleted_by?: string[];
  is_system?: boolean;
  doc_type?: string;
  verification_status?: string;
  attachment?: {
    url: string;
    filename: string;
    size: number;
    type: string;  // "image" | "video" | "voice" | "document" | "audio"
    content_type: string;
  };
}

export interface Conversation {
  id: string;
  participants: string[];
  participant_names: string[];
  created_at: string;
  updated_at: string;
  last_message: { content: string; sender: string; timestamp: string } | null;
  unread: Record<string, number>;
  deleted_by?: string[];
}

export interface QuoteRequest {
  id: string;
  client_email: string;
  client_name: string;
  client_id: string;
  company_slug: string;
  project_title: string;
  description: string;
  location: string;
  budget: string;
  plot_size: string;
  status: "pending" | "accepted" | "rejected" | "completed";
  created_at: string;
  updated_at: string;
  company_notes: string;
}

export interface RequestStats {
  total: number;
  pending: number;
  accepted: number;
  rejected: number;
  completed: number;
}

export interface EnrichedRecommendation {
  id: string;
  name: string;
  type: "company" | "supplier";
  score: number;
  location?: string;
  description?: string;
  logo_url?: string;
  dp_url?: string;
  city?: string;
  contact?: Record<string, string>;
  services?: Record<string, unknown>;
  construction_capability?: Record<string, unknown>;
  verification_status?: string;
  experience?: Record<string, unknown>;
  year_established?: number;
  ai_scores?: Record<string, number>;
  min_price_sqft?: number;
  max_price_sqft?: number;
  gallery_images?: string[];
  rating?: number;
  materials?: Record<string, unknown>[];
  cities_served?: string[];
}

export interface AdminFile {
  filename: string;
  url: string;
  sender: string;
  conversation_id: string;
  category: string;
  size: number;
  uploaded_at: string;
}

export interface ChatSessionMeta {
  session_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
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
    getProfile: () => request<Record<string, unknown>>("/auth/profile"),
    updateProfile: (data: { display_name?: string; phone?: string; preferences?: Record<string, unknown>; profile_pic?: string }) =>
      request<{ status: string }>("/auth/profile", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    changePassword: (current_password: string, new_password: string) =>
      request<{ status: string }>("/auth/change-password", {
        method: "PUT",
        body: JSON.stringify({ current_password, new_password }),
      }),
  },

  companies: {
    list: (params?: { page?: number; limit?: number; city?: string; verified?: boolean }) => {
      const qs = new URLSearchParams();
      if (params?.page) qs.set("page", String(params.page));
      if (params?.limit) qs.set("limit", String(params.limit));
      if (params?.city) qs.set("city", params.city);
      if (params?.verified !== undefined) qs.set("verified", String(params.verified));
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      return request<{ items: Record<string, unknown>[]; total: number; page: number; limit: number }>(`/companies/${suffix}`)
        .then((res) => ({ ...res, items: withEntityImages(res.items, "company") }));
    },
    get: (id: string) => request<Record<string, unknown>>(`/companies/${encodeURIComponent(id)}`)
      .then((c) => withEntityImage(c, "company") as Record<string, unknown>),
    getProfile: (slug: string) =>
      request<Record<string, unknown>>(`/companies/profile/${encodeURIComponent(slug)}`)
        .then((c) => withEntityImage(c, "company") as Record<string, unknown>),
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
    updateProjects: (slug: string, projects: Record<string, unknown>[]) =>
      request<{ status: string }>(`/companies/profile/${encodeURIComponent(slug)}/projects`, {
        method: "PUT",
        body: JSON.stringify({ projects }),
      }),
  },

  suppliers: {
    list: (params?: { page?: number; limit?: number; city?: string; verified?: boolean }) => {
      const qs = new URLSearchParams();
      if (params?.page) qs.set("page", String(params.page));
      if (params?.limit) qs.set("limit", String(params.limit));
      if (params?.city) qs.set("city", params.city);
      if (params?.verified !== undefined) qs.set("verified", String(params.verified));
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      return request<{ items: Record<string, unknown>[]; total: number; page: number; limit: number }>(`/suppliers/${suffix}`)
        .then((res) => ({ ...res, items: withEntityImages(res.items, "supplier") }));
    },
    get: (id: string) => request<Record<string, unknown>>(`/suppliers/${encodeURIComponent(id)}`)
      .then((s) => withEntityImage(s, "supplier") as Record<string, unknown>),
    getProfile: (slug: string) =>
      request<Record<string, unknown>>(`/suppliers/profile/${encodeURIComponent(slug)}`)
        .then((s) => withEntityImage(s, "supplier") as Record<string, unknown>),
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
    getUsers: (params?: { page?: number; limit?: number; role?: string; status?: string }) => {
      const qs = new URLSearchParams();
      if (params?.page) qs.set("page", String(params.page));
      if (params?.limit) qs.set("limit", String(params.limit));
      if (params?.role) qs.set("role", params.role);
      if (params?.status) qs.set("status", params.status);
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      return request<{ items: AdminUser[]; total: number; page: number; limit: number }>(`/admin/users${suffix}`);
    },
    getActivity: () => request<ActivityEntry[]>("/admin/activity"),
    updateUserStatus: (userId: string, status: string) =>
      request<{ status: string }>("/admin/users/status", {
        method: "PUT",
        body: JSON.stringify({ user_id: userId, status }),
      }),
    getStats: () => request<Record<string, unknown>>("/admin/stats"),
    getCompanies: () => request<Record<string, unknown>[]>("/admin/companies")
      .then((items) => withEntityImages(items, "company")),
    getSuppliers: () => request<Record<string, unknown>[]>("/admin/suppliers")
      .then((items) => withEntityImages(items, "supplier")),
    updateVerification: (slug: string, entityType: string, docType: string, status: string, notes = "") =>
      request<{ status: string; verification_status: string }>("/admin/verification", {
        method: "PUT",
        body: JSON.stringify({ slug, entity_type: entityType, doc_type: docType, status, notes }),
      }),
    listFiles: (fileType?: string, limit = 50) => {
      const qs = new URLSearchParams();
      if (fileType) qs.set("file_type", fileType);
      qs.set("limit", String(limit));
      return request<{ files: AdminFile[]; total: number }>(`/ai/admin/files?${qs.toString()}`);
    },
    deleteFile: (url: string) =>
      request<{ status: string; deleted: string }>(`/ai/admin/files?url=${encodeURIComponent(url)}`, { method: "DELETE" }),
  },

  messages: {
    getConversations: () =>
      request<Conversation[]>("/messages/conversations"),
    startConversation: (recipientEmail: string, recipientName: string, message: string, attachment?: { url: string; filename: string; size: number; type: string; content_type: string }) =>
      request<{ conversation_id: string; message: Message }>("/messages/conversations", {
        method: "POST",
        body: JSON.stringify({
          recipient_email: recipientEmail,
          recipient_name: recipientName,
          message,
          ...(attachment ? {
            attachment_url: attachment.url,
            attachment_filename: attachment.filename,
            attachment_size: attachment.size,
            attachment_type: attachment.type,
            attachment_content_type: attachment.content_type,
          } : {}),
        }),
      }),
    getMessages: (conversationId: string) =>
      request<{ conversation: Conversation; messages: Message[] }>(`/messages/conversations/${encodeURIComponent(conversationId)}`),
    sendMessage: (conversationId: string, content: string, attachment?: { url: string; filename: string; size: number; type: string; content_type: string }) =>
      request<Message>(`/messages/conversations/${encodeURIComponent(conversationId)}`, {
        method: "POST",
        body: JSON.stringify({
          content,
          ...(attachment ? {
            attachment_url: attachment.url,
            attachment_filename: attachment.filename,
            attachment_size: attachment.size,
            attachment_type: attachment.type,
            attachment_content_type: attachment.content_type,
          } : {}),
        }),
      }),
    getUnreadCount: () =>
      request<{ unread: number }>("/messages/unread"),
    deleteConversation: (conversationId: string) =>
      request<{ status: string }>(`/messages/conversations/${encodeURIComponent(conversationId)}`, {
        method: "DELETE",
      }),
    deleteMessage: (conversationId: string, messageId: string) =>
      request<{ status: string }>(`/messages/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`, {
        method: "DELETE",
      }),
    // Admin endpoints
    adminListConversations: (userEmail?: string) => {
      const qs = userEmail ? `?user_email=${encodeURIComponent(userEmail)}` : "";
      return request<(Conversation & { message_count: number })[]>(`/messages/admin/conversations${qs}`);
    },
    adminGetMessages: (conversationId: string) =>
      request<{ conversation: Conversation; messages: Message[] }>(`/messages/admin/conversations/${encodeURIComponent(conversationId)}`),
    adminSummarize: (conversationId: string) =>
      request<{ summary: string; message_count: number; window_size: number }>(`/messages/admin/summary/${encodeURIComponent(conversationId)}`),
    getAdminContact: () =>
      request<{ email: string; name: string }>("/messages/admin-contact"),
  },

  ai: {
    chat: (messages: { role: string; content: string }[], userEmail = "", userRole = "client") =>
      request<{ response: string; recommendations?: unknown[] }>("/ai/chat", {
        method: "POST",
        body: JSON.stringify({ messages, user_email: userEmail, user_role: userRole }),
      }),
    chatStream: async function* (
      messages: { role: string; content: string }[],
      userEmail = "",
      userRole = "client",
    ): AsyncGenerator<{ type: string; content?: string; recommendations?: unknown[] }> {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120_000);
      try {
        const res = await fetch(`${API_BASE}/ai/chat/stream`, {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json", ..._authHeaders() },
          body: JSON.stringify({ messages, user_email: userEmail, user_role: userRole }),
        });
        if (!res.ok || !res.body) {
          yield { type: "error", content: "Failed to connect to AI." };
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6).trim();
              if (data === "[DONE]") return;
              try {
                yield JSON.parse(data);
              } catch { /* skip malformed */ }
            }
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          yield { type: "error", content: "Request timed out." };
        } else {
          yield { type: "error", content: "Stream connection failed." };
        }
      } finally {
        clearTimeout(timeoutId);
      }
    },
    chatWithFile: async (
      file: File,
      messages: { role: string; content: string }[],
      userEmail = "",
      userRole = "client",
    ): Promise<{ response: string; recommendations?: unknown[] }> => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("messages", JSON.stringify(messages));
      formData.append("user_email", userEmail);
      formData.append("user_role", userRole);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120_000);
      try {
        const res = await fetch(`${API_BASE}/ai/chat-with-file`, {
          method: "POST",
          signal: controller.signal,
          headers: _authHeaders(),
          body: formData,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { detail?: string };
          throw new Error(body.detail ?? `Request failed: ${res.status}`);
        }
        return res.json();
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          throw new Error("Request timed out. Please try again.");
        }
        throw err;
      } finally {
        clearTimeout(timeoutId);
      }
    },
    clearSession: (email: string) =>
      request<{ status: string }>(`/ai/session/${encodeURIComponent(email)}`, { method: "DELETE" }),
    getSessionFiles: (email: string) =>
      request<{ files: { id: string; filename: string; summary: string; keywords: string[] }[] }>(
        `/ai/session/${encodeURIComponent(email)}`
      ),
    extractRequirements: (messages: { role: string; content: string }[], userEmail: string, userRole = "client") =>
      request<{
        requirements: Record<string, unknown>;
        recommendations: EnrichedRecommendation[];
        is_complete: boolean;
        missing_fields: string[];
      }>("/ai/requirements/extract", {
        method: "POST",
        body: JSON.stringify({ messages, user_email: userEmail, user_role: userRole }),
      }),
    getRequirements: (email: string) =>
      request<{ requirements: Record<string, unknown> }>(`/ai/requirements/${encodeURIComponent(email)}`),
    clearRequirements: (email: string) =>
      request<{ status: string }>(`/ai/requirements/${encodeURIComponent(email)}`, { method: "DELETE" }),

    // ── Persistent chat history (ChatGPT-style) ──
    listChatSessions: () =>
      request<{ sessions: ChatSessionMeta[] }>("/ai/history"),
    createChatSession: (title: string, messages: { role: string; content: string }[]) =>
      request<{ session_id: string; title: string; created_at: string }>("/ai/history", {
        method: "POST",
        body: JSON.stringify({ title, messages }),
      }),
    getChatSession: (sessionId: string) =>
      request<{ session_id: string; title: string; created_at: string; updated_at: string; messages: { role: string; content: string }[] }>(
        `/ai/history/${encodeURIComponent(sessionId)}`
      ),
    updateChatSession: (sessionId: string, data: { title?: string; messages?: { role: string; content: string }[] }) =>
      request<{ session_id: string; title: string; updated_at: string }>(`/ai/history/${encodeURIComponent(sessionId)}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    deleteChatSession: (sessionId: string) =>
      request<{ status: string; session_id: string }>(`/ai/history/${encodeURIComponent(sessionId)}`, {
        method: "DELETE",
      }),
    renameChatSession: (sessionId: string, title: string) =>
      request<{ session_id: string; title: string }>(`/ai/history/${encodeURIComponent(sessionId)}/rename`, {
        method: "PATCH",
        body: JSON.stringify({ title }),
      }),
  },

  requests: {
    list: () => request<QuoteRequest[]>("/requests/"),
    get: (id: string) => request<QuoteRequest>(`/requests/${encodeURIComponent(id)}`),
    create: (data: {
      company_slug: string;
      project_title: string;
      description?: string;
      location?: string;
      budget?: string;
      plot_size?: string;
    }) =>
      request<QuoteRequest>("/requests/", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    updateStatus: (id: string, status: string) =>
      request<{ status: string; request: QuoteRequest }>(`/requests/${encodeURIComponent(id)}/status`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      }),
    respond: (id: string, notes: string) =>
      request<{ status: string }>(`/requests/${encodeURIComponent(id)}/respond`, {
        method: "PUT",
        body: JSON.stringify({ notes }),
      }),
    stats: () => request<RequestStats>("/requests/stats/summary"),
    aiSuggest: (data: {
      location?: string;
      plot_size?: string;
      construction_type?: string;
      budget?: string;
      description?: string;
    }) =>
      request<{ suggestion: string; status: string }>("/requests/ai-suggest", {
        method: "POST",
        body: JSON.stringify(data),
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
      const timeoutId = setTimeout(() => controller.abort(), 120_000);
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
      const timeoutId = setTimeout(() => controller.abort(), 120_000);
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
    gallery: async (file: File, entityName: string, galleryType: string, itemId: string, role: string = "supplier"): Promise<string> => {
      const form = new FormData();
      form.append("file", file);
      form.append("entity_name", entityName);
      form.append("gallery_type", galleryType);
      form.append("item_id", itemId);
      form.append("role", role);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120_000);
      try {
        const res = await fetch(`${API_BASE}/upload/gallery`, {
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
    messageFile: async (
      file: File,
      senderEmail: string,
      conversationId: string,
      fileType: "file" | "voice" | "image" | "video" = "file",
    ): Promise<{ url: string; filename: string; size: number; content_type: string; category: string; file_type: string }> => {
      const form = new FormData();
      form.append("file", file);
      form.append("sender_email", senderEmail);
      form.append("conversation_id", conversationId);
      form.append("file_type", fileType);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60_000);
      try {
        const res = await fetch(`${API_BASE}/upload/message-file`, {
          method: "POST",
          body: form,
          signal: controller.signal,
          headers: _authHeaders(),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { detail?: string };
          throw new Error(body.detail ?? `Upload failed: ${res.status}`);
        }
        return res.json();
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

  // ── Analytics (admin) ──
  analytics: {
    overview: () => request<Record<string, unknown>>("/analytics/overview"),
    topCompanies: () => request<Record<string, unknown>[]>("/analytics/top-companies"),
    supplyDemand: () => request<Record<string, unknown>[]>("/analytics/supply-demand"),
  },

  // ── Embeddings (admin) ──
  embeddings: {
    stats: () => request<Record<string, unknown>>("/embeddings/stats"),
    rebuild: () => request<{ status: string; entities_indexed: number }>("/embeddings/rebuild", { method: "POST" }),
  },

  // ── Event log (admin) ──
  events: {
    log: () => request<Record<string, unknown>[]>("/events/log"),
  },

  // ── Semantic search ──
  search: (q: string, type?: string, limit?: number) => {
    const params = new URLSearchParams({ q });
    if (type) params.set("type", type);
    if (limit) params.set("limit", String(limit));
    return request<Record<string, unknown>[]>(`/search?${params.toString()}`);
  },
};
