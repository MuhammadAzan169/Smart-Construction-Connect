/**
 * AdminAIChatPage — AI Analytics Assistant for platform admins.
 *
 * Right panel: Platform Command Center
 *  • Live platform overview from /analytics/overview
 *  • Pending approvals alert with direct link
 *  • Supply vs demand quick snapshot
 *  • Quick admin query shortcuts
 *
 * Chat: same bilingual engine, role="admin" hardcoded.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, User, Send, Paperclip, FileText, X,
  BarChart3, Bot, Building2, Package, Users, ShieldAlert,
  ShieldCheck, Zap, TrendingUp, Activity, ChevronLeft, ChevronRight,
  AlertCircle, CircleDot, MessageSquare, Mic,
  Square, Play, RotateCcw, Check,
  History, Trash2, Plus, Layers,
} from "lucide-react";

import { GlassCard } from "@/components/shared/GlassCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { renderMarkdown } from "@/components/shared/MarkdownRenderer";
import { api, type ChatSessionMeta } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";

/* ── Types ─────────────────────────────────────────────────────────── */
interface Message { id: number; role: "user" | "ai"; text: string; isStreaming?: boolean; }

interface Overview {
  users: { total: number; active: number; pending: number; banned: number; recent_signups: number };
  companies: { total: number; verified: number; pending: number; avg_rating: number; total_reviews: number };
  suppliers: { total: number; verified: number; pending: number; avg_rating: number };
  activity: { total: number; recent_week: number };
  ai_usage: { total_chats: number; recent_week: number };
}

/* ═════════════════════════════════════════════════════════════════════
   Main Page
═════════════════════════════════════════════════════════════════════ */
export default function AdminAIChatPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  /* ── Chat state ── */
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioPreviewRef = useRef<HTMLAudioElement>(null);
  const voice = useVoiceRecorder();
  const nextIdRef = useRef(1);
  const getNextId = useCallback(() => nextIdRef.current++, []);

  /* ── Platform data state ── */
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loadingOv, setLoadingOv] = useState(true);

  /* ── Chat History state ── */
  const [chatSessions, setChatSessions] = useState<ChatSessionMeta[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sidebarTab, setSidebarTab] = useState<"overview">("overview");
  const [historyOpen, setHistoryOpen] = useState(false);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  /* ── Load greeting ── */
  useEffect(() => {
    api.ai.chat([], user?.email || "", "admin").then((res) => {
      setMessages([{ id: getNextId(), role: "ai", text: res.response }]);
    }).catch(() => {
      setMessages([{ id: getNextId(), role: "ai", text: "Hello Admin! 📊 I have access to the full platform data. Ask me about users, companies, suppliers, market trends, or pending approvals." }]);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Load platform overview ── */
  useEffect(() => {
    api.analytics.overview().then((data) => {
      setOverview(data as unknown as Overview);
    }).catch(() => {}).finally(() => setLoadingOv(false));
  }, []);

  /* ── Load chat history sessions ── */
  useEffect(() => {
    if (!user?.email) return;
    setLoadingHistory(true);
    api.ai.listChatSessions()
      .then((res) => setChatSessions((res.sessions || []).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())))
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email]);

  /* ── Auto-scroll ── */
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const update = () => { shouldAutoScrollRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48; };
    update();
    el.addEventListener("scroll", update, { passive: true });
    return () => el.removeEventListener("scroll", update);
  }, []);
  useEffect(() => {
    if (!shouldAutoScrollRef.current) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  /* ── History callbacks ── */
  const saveSession = useCallback(async (msgs: Message[]) => {
    if (!user?.email || msgs.length < 2) return;
    const title = msgs.find((m) => m.role === "user")?.text.slice(0, 60) ?? "New Chat";
    try {
      if (currentSessionId) {
        const updated = await api.ai.updateChatSession(currentSessionId, { messages: msgs.map((m) => ({ role: m.role === "ai" ? "assistant" : "user", content: m.text })) });
        setChatSessions((prev) => prev.map((s) => s.session_id === currentSessionId ? { ...s, ...updated } : s).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()));
      } else {
        const newSession = await api.ai.createChatSession(title, msgs.map((m) => ({ role: m.role === "ai" ? "assistant" : "user", content: m.text })));
        setCurrentSessionId(newSession.session_id);
        setChatSessions((prev) => [newSession, ...prev]);
      }
    } catch { /* silent */ }
  }, [currentSessionId, user?.email]);

  /* ── Send (streaming) ── */
  const handleSend = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if ((!text && !attachedFile) || isTyping) return;

    const displayText = attachedFile ? `${text || ""}${text ? "\n" : ""}📎 ${attachedFile.name}` : text;
    const userMsg: Message = { id: getNextId(), role: "user", text: displayText };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    const currentFile = attachedFile;
    setAttachedFile(null);
    setIsTyping(true);

    try {
      const history = [...messages, { ...userMsg, text: text || `Analyse attached file: ${currentFile?.name}` }]
        .map((m) => ({ role: m.role === "ai" ? "assistant" : "user", content: m.text }));

      if (currentFile) {
        const result = await api.ai.chatWithFile(currentFile, history, user?.email || "", "admin");
        setMessages((prev) => {
          const m = [...prev, { id: getNextId(), role: "ai" as const, text: result.response }];
          if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
          autoSaveTimerRef.current = setTimeout(() => saveSession(m), 1500);
          return m;
        });
      } else {
        const streamMsgId = getNextId();
        setMessages((prev) => [...prev, { id: streamMsgId, role: "ai", text: "", isStreaming: true }]);
        let fullText = "";
        for await (const chunk of api.ai.chatStream(history, user?.email || "", "admin")) {
          if (chunk.type === "token" && chunk.content) {
            fullText += chunk.content;
            setMessages((prev) => prev.map((m) => m.id === streamMsgId ? { ...m, text: fullText } : m));
          } else if (chunk.type === "error" && chunk.content) {
            fullText = chunk.content;
          } else if (chunk.type === "done") {
            setMessages((prev) => prev.map((m) => m.id === streamMsgId ? { ...m, isStreaming: false } : m));
          }
        }
        if (!fullText) {
          setMessages((prev) => prev.map((m) => m.id === streamMsgId ? { ...m, text: "Connection issue. Please try again.", isStreaming: false } : m));
        } else {
          setMessages((prev) => {
            const updated = prev.map((m) => m.id === streamMsgId ? { ...m, isStreaming: false } : m);
            if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
            autoSaveTimerRef.current = setTimeout(() => saveSession(updated), 1500);
            return updated;
          });
        }
      }
    } catch {
      setMessages((prev) => [...prev, { id: getNextId(), role: "ai", text: "Connection issue. Please try again." }]);
    } finally {
      setIsTyping(false);
    }
  }, [getNextId, input, isTyping, messages, user?.email, attachedFile, saveSession]);

  /* ── Voice handling ── */
  const handleVoiceAccept = useCallback(() => {
    const text = voice.acceptTranscript();
    if (text.trim()) {
      setInput(text);
      handleSend(text);
    }
  }, [voice, handleSend]);

  const loadSession = useCallback(async (sessionId: string) => {
    try {
      const session = await api.ai.getChatSession(sessionId);
      setCurrentSessionId(sessionId);
      setMessages(session.messages.map((m: { role: string; content: string }, i: number) => ({
        id: i + 1,
        role: m.role === "assistant" ? "ai" : "user",
        text: m.content,
      })));
      nextIdRef.current = session.messages.length + 1;
    } catch { /* silent */ }
  }, []);

  const startNewChat = useCallback(() => {
    setCurrentSessionId(null);
    setMessages([]);
    api.ai.chat([], user?.email || "", "admin").then((res) => {
      setMessages([{ id: getNextId(), role: "ai", text: res.response }]);
    }).catch(() => {
      setMessages([{ id: getNextId(), role: "ai", text: "Hello Admin! 📊 I have access to the full platform data. Ask me about users, companies, suppliers, market trends, or pending approvals." }]);
    });
  }, [user?.email, getNextId]);

  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      await api.ai.deleteChatSession(sessionId);
      setChatSessions((prev) => prev.filter((s) => s.session_id !== sessionId));
      if (currentSessionId === sessionId) startNewChat();
    } catch { /* silent */ }
  }, [currentSessionId, startNewChat]);

  /* ── Pending approvals count ── */
  const pendingTotal = overview ? (overview.companies.pending + overview.suppliers.pending) : 0;

  /* ── Inject suggestion into input ── */
  const injectPrompt = (s: string) => {
    setInput(s);
    document.getElementById("admin-chat-input")?.focus();
  };

  const ADMIN_PROMPTS = [
    "Give me a full platform health summary",
    "Which companies have the highest ratings and most projects?",
    "List all pending company approvals",
    "What are current market prices for all construction materials?",
    "Show me supply vs demand gaps by city",
    "How many new users signed up this week?",
    "Which cities have the most active suppliers?",
    "What is the AI assistant usage trend?",
  ];

  if (!user || user.role !== "admin") {
    return (
      <GlassCard interactive={false} className="p-6">
        <p className="text-sm text-muted-foreground">Admin access required.</p>
      </GlassCard>
    );
  }

  return (
    <motion.div
      className="flex flex-1 min-h-0 gap-3"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      {/* ════ Left: Chat History Sidebar ════ */}
      <AnimatePresence initial={false}>
        {historyOpen && (
          <motion.div
            key="history-sidebar"
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "14rem" }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="hidden lg:flex flex-col overflow-hidden shrink-0"
            style={{ minWidth: 0 }}
          >
            <GlassCard interactive={false} className="flex flex-col h-full p-0 overflow-hidden card-shadow">
              <div className="flex items-center gap-2 border-b border-border px-3 py-3 shrink-0">
                <History className="h-4 w-4 text-violet-500 shrink-0" />
                <span className="text-sm font-semibold text-foreground flex-1 truncate">History</span>
                <button type="button" onClick={startNewChat} title="New chat"
                  className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
                  <Plus className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => setHistoryOpen(false)} title="Close"
                  className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto scroll-styled py-2">
                {chatSessions.length === 0 ? (
                  <p className="px-3 py-6 text-center text-xs text-muted-foreground">No saved chats yet</p>
                ) : (
                  chatSessions.map((s) => (
                    <div
                      key={s.session_id}
                      className={`group relative flex flex-col px-3 py-2 mx-1 rounded-lg cursor-pointer transition-colors hover:bg-secondary/70 ${
                        currentSessionId === s.session_id ? "bg-violet-500/10 hover:bg-violet-500/15" : ""
                      }`}
                      onClick={() => loadSession(s.session_id)}
                    >
                      <span className="text-xs font-medium text-foreground truncate leading-snug pr-8">
                        {s.title || "Untitled chat"}
                      </span>
                      <span className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(s.updated_at).toLocaleDateString("en-PK", { month: "short", day: "numeric" })}
                        {" · "}{s.message_count} msg{s.message_count !== 1 ? "s" : ""}
                      </span>
                      <button type="button" title="Delete"
                        onClick={(e) => { e.stopPropagation(); deleteSession(s.session_id); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex h-6 w-6 items-center justify-center rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-all">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>
      {!historyOpen && (
        <button type="button" onClick={() => setHistoryOpen(true)} title="Open chat history"
          className="hidden lg:flex h-9 w-9 shrink-0 self-start mt-2 items-center justify-center rounded-xl border border-border bg-card hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground shadow-sm">
          <ChevronRight className="h-4 w-4" />
        </button>
      )}

      {/* ═══════════════════════════════════════════════════════════
          Center: Chat Panel
      ═══════════════════════════════════════════════════════════ */}
      <GlassCard interactive={false} className="flex flex-1 flex-col p-0 overflow-hidden card-shadow">

        {/* Header */}
        <div className="relative flex items-center gap-3 border-b border-border px-5 py-4 overflow-hidden">
          <div className="absolute start-0 top-0 h-full w-40 bg-gradient-to-r from-violet-500/8 to-transparent pointer-events-none" />
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="relative flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500 shadow-md">
            <BarChart3 className="h-5 w-5 text-white" />
            <div className="absolute inset-0 rounded-xl ring-2 ring-violet-500/30" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground leading-tight">{t("aiChat.aiAnalytics")}</h2>
            <p className="text-[11px] text-muted-foreground leading-tight">{t("aiChat.analyticsDesc")}</p>
          </div>
          <div className="ml-auto flex items-center gap-2.5">
            {pendingTotal > 0 && (
              <button
                type="button"
                onClick={() => navigate("/approvals")}
                className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-xs font-semibold text-amber-600 hover:bg-amber-500/20 transition-colors border border-amber-500/20"
              >
                <ShieldAlert className="h-3 w-3" />{pendingTotal} pending
              </button>
            )}
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-medium text-emerald-500">Online</span>
          </div>
        </div>

        {/* Messages */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto scroll-styled px-5 py-5 space-y-3"
          role="log"
          aria-live="polite"
        >
          {messages.length === 1 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="flex flex-wrap gap-2 pb-1"
            >
              {ADMIN_PROMPTS.slice(0, 4).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => injectPrompt(s)}
                  className="rounded-xl border border-violet-500/20 bg-violet-500/5 px-3 py-1.5 text-xs text-muted-foreground hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-foreground transition-colors text-start"
                >
                  {s}
                </button>
              ))}
            </motion.div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.2 }}
                className={`flex items-end gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
              >
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl shadow-sm ${
                  msg.role === "ai" ? "bg-violet-500" : "bg-secondary border border-border"
                }`}>
                  {msg.role === "ai" ? <BarChart3 className="h-4 w-4 text-white" /> : <User className="h-4 w-4 text-muted-foreground" />}
                </div>
                <div
                  className={`max-w-[85%] md:max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm overflow-hidden break-words ${
                    msg.role === "ai"
                      ? "bg-secondary text-foreground rounded-bl-md"
                      : "bg-violet-500 text-white rounded-br-md"
                  }`}
                  dir="auto"
                >
                  {msg.role === "ai" ? (
                    <>
                      {renderMarkdown(msg.text)}
                      {msg.isStreaming && (
                        <span className="ms-1 inline-block h-4 w-1.5 rounded-sm bg-violet-500 animate-pulse" />
                      )}
                    </>
                  ) : <span className="whitespace-pre-wrap">{msg.text}</span>}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {isTyping && !messages.some(m => m.isStreaming) && (
            <motion.div
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex items-end gap-2.5"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-500 shadow-sm">
                <BarChart3 className="h-4 w-4 text-white" />
              </div>
              <div className="rounded-2xl rounded-bl-md bg-secondary px-4 py-3 shadow-sm">
                <div className="flex gap-1.5 items-center">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
                      transition={{ repeat: Infinity, duration: 0.7, delay: i * 0.18 }}
                      className="h-2 w-2 rounded-full bg-muted-foreground/50"
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border px-5 py-4">
          {attachedFile && !voice.isRecording && !voice.isPreviewing && (
            <div className="mb-2 flex items-center gap-2 rounded-xl border border-violet-500/20 bg-violet-500/5 px-3 py-2">
              <FileText className="h-4 w-4 text-violet-500 shrink-0" />
              <span className="flex-1 truncate text-xs text-foreground">{attachedFile.name}</span>
              <span className="text-[10px] text-muted-foreground">{(attachedFile.size / 1024).toFixed(0)} KB</span>
              <button type="button" onClick={() => setAttachedFile(null)} className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-secondary">
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
            </div>
          )}
          <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); handleSend(); }}>
            <input
              ref={fileInputRef} type="file" className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.json,.txt,.md,.png,.jpg,.jpeg,.webp,.tiff,.bmp"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) { if (f.size > 10 * 1024 * 1024) alert("File must be under 10 MB"); else setAttachedFile(f); }
                e.target.value = "";
              }}
            />



            {/* Recording state: compact inline waveform */}
            {voice.isRecording && (
              <>
                <div className="flex-1 flex items-start gap-2.5 rounded-2xl border border-red-500/40 bg-red-500/5 px-3 py-2 min-w-0 max-h-24 overflow-y-auto">
                  <div className="flex items-end gap-[2px] shrink-0 mt-0.5" style={{ height: 16 }}>
                    {[0.4, 1, 0.6, 0.9, 0.5].map((_, i) => (
                      <motion.span key={i} animate={{ scaleY: [0.35, 1, 0.35] }} transition={{ repeat: Infinity, duration: 0.55, delay: i * 0.1 }}
                        className="block w-[3px] rounded-full bg-red-500 origin-bottom h-full" />
                    ))}
                  </div>
                  <span className="text-xs font-semibold text-red-500 shrink-0 tabular-nums mt-0.5">{voice.duration}s</span>
                  <span className="flex-1 text-xs text-muted-foreground italic min-w-0 break-words">{voice.error ? <span className="text-amber-500 not-italic">{voice.error}</span> : voice.transcript || "Listening\u2026"}</span>
                </div>
                <motion.button type="button" onClick={voice.stopRecording}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-red-500/50 bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                  whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }} aria-label="Stop recording">
                  <Square className="h-4 w-4" />
                </motion.button>
                <motion.button type="button" onClick={voice.cancelRecording}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-secondary/40 text-muted-foreground hover:text-foreground transition-colors"
                  whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }} aria-label="Cancel recording">
                  <X className="h-4 w-4" />
                </motion.button>
              </>
            )}

            {/* Preview state: inline editable transcript */}
            {voice.isPreviewing && (
              <>
                {voice.audioUrl && (
                  <>
                    <audio ref={audioPreviewRef} src={voice.audioUrl} className="hidden" />
                    <motion.button type="button" onClick={() => { if (audioPreviewRef.current) { audioPreviewRef.current.currentTime = 0; audioPreviewRef.current.play(); } }}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-violet-500/30 bg-violet-500/5 text-violet-500 hover:bg-violet-500/10 transition-colors"
                      whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }} aria-label="Play recording">
                      <Play className="h-4 w-4" />
                    </motion.button>
                  </>
                )}
                <div className="flex-1 flex items-start rounded-2xl border border-violet-500/30 bg-violet-500/5 px-3 py-1 focus-within:border-violet-500/50 transition-colors min-w-0">
                  <textarea value={voice.transcript} onChange={(e) => voice.setTranscript(e.target.value)}
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none min-w-0 py-1.5 resize-none max-h-20 overflow-y-auto"
                    placeholder="Edit transcript before sending…"
                    rows={1}
                    onInput={(e) => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 80) + 'px'; }}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && voice.transcript.trim()) { e.preventDefault(); handleVoiceAccept(); } }}
                  />
                </div>
                <motion.button type="button" onClick={voice.cancelRecording}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-secondary/40 text-muted-foreground hover:text-foreground transition-colors"
                  whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }} aria-label="Re-record">
                  <RotateCcw className="h-4 w-4" />
                </motion.button>
                <motion.button type="button" onClick={handleVoiceAccept} disabled={!voice.transcript.trim()}
                  className="flex h-10 shrink-0 items-center gap-1.5 rounded-2xl bg-violet-500 px-3 text-xs font-medium text-white shadow-sm disabled:opacity-40 transition-opacity"
                  whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }} aria-label="Use transcript">
                  <Check className="h-3.5 w-3.5" /> Use
                </motion.button>
              </>
            )}

            {/* Normal state: text input + attach + mic + send */}
            {!voice.isRecording && !voice.isPreviewing && (
              <>
                <div className="flex-1 flex items-center gap-2 rounded-2xl border border-border bg-secondary/40 px-4 py-1 focus-within:border-violet-500/40 transition-colors">
                  <textarea
                    id="admin-chat-input"
                    rows={1}
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px';
                    }}
                    placeholder={attachedFile ? "Add a message about the file..." : "Ask about platform data, users, analytics, approvals…"}
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none focus:outline-none min-w-0 py-2 resize-none max-h-32 overflow-y-auto"
                    disabled={isTyping}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); (e.target as HTMLTextAreaElement).style.height = 'auto'; } }}
                  />
                </div>
                <motion.button type="button" onClick={() => fileInputRef.current?.click()} disabled={isTyping}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-secondary/40 text-muted-foreground hover:text-foreground hover:border-violet-500/30 transition-colors disabled:opacity-40"
                  whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}>
                  <Paperclip className="h-4 w-4" />
                </motion.button>
                {voice.isSupported && (
                  <motion.button type="button" onClick={() => voice.startRecording("auto")} disabled={isTyping}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-secondary/40 text-muted-foreground hover:text-foreground hover:border-violet-500/30 transition-colors disabled:opacity-40"
                    whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }} aria-label="Record voice">
                    <Mic className="h-4 w-4" />
                  </motion.button>
                )}
                <motion.button type="submit" disabled={(!input.trim() && !attachedFile) || isTyping}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-500 text-white shadow-sm disabled:opacity-40"
                  whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}>
                  <Send className="h-4 w-4" />
                </motion.button>
              </>
            )}
          </form>
          <p className="mt-1.5 text-center text-[10px] text-muted-foreground/50">
            Enter to send · 📎 Attach reports or data files · 🎤 Voice input · AI uses live platform data
          </p>
        </div>
      </GlassCard>

      {/* ═══════════════════════════════════════════════════════════
          Right: Platform Command Center
      ═══════════════════════════════════════════════════════════ */}
      <div className="hidden lg:flex w-80 flex-col gap-3">

        {/* Platform stats */}
        <GlassCard interactive={false} className="p-0 overflow-hidden card-shadow flex flex-col">
          <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5 shrink-0">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/10">
              <BarChart3 className="h-3.5 w-3.5 text-violet-500" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-foreground">Platform Overview</h3>
              <p className="text-[11px] text-muted-foreground">Live data snapshot</p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/analytics")}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium text-violet-500 hover:bg-violet-500/10 transition-colors"
            >
              Full Analytics <ChevronRight className="h-3 w-3" />
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto scroll-styled">
          {loadingOv ? (
            <div className="flex items-center justify-center py-8">
              <Bot className="h-5 w-5 animate-pulse text-muted-foreground/30" />
            </div>
          ) : overview ? (
            <>
              {/* Pending approvals alert */}
              {pendingTotal > 0 && (
                <div className="mx-3 mt-3 flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/8 p-3">
                  <ShieldAlert className="h-5 w-5 shrink-0 text-amber-500" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-amber-600">{pendingTotal} Pending Approval{pendingTotal > 1 ? "s" : ""}</p>
                    <p className="text-[10px] text-muted-foreground">{overview.companies.pending} companies · {overview.suppliers.pending} suppliers</p>
                  </div>
                  <Button
                    type="button" size="sm" variant="ghost"
                    className="h-7 shrink-0 text-xs text-amber-600 hover:bg-amber-500/10"
                    onClick={() => navigate("/approvals")}
                  >
                    Review <ChevronRight className="h-3 w-3 ms-0.5" />
                  </Button>
                </div>
              )}

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-px bg-border mt-3">
                {[
                  { icon: Users, label: "Total Users", value: overview.users.total, sub: `+${overview.users.recent_signups} this week`, color: "text-blue-500", bg: "bg-blue-500/10" },
                  { icon: Building2, label: "Companies", value: overview.companies.total, sub: `${overview.companies.verified} verified`, color: "text-primary", bg: "bg-primary/10" },
                  { icon: Package, label: "Suppliers", value: overview.suppliers.total, sub: `${overview.suppliers.verified} verified`, color: "text-orange-500", bg: "bg-orange-500/10" },
                  { icon: Activity, label: "Activity", value: overview.activity.recent_week, sub: "events this week", color: "text-emerald-500", bg: "bg-emerald-500/10" },
                ].map(({ icon: Icon, label, value, sub, color, bg }) => (
                  <div key={label} className="flex flex-col gap-1 bg-background/60 p-3">
                    <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${bg}`}>
                      <Icon className={`h-3.5 w-3.5 ${color}`} />
                    </div>
                    <span className={`text-lg font-bold ${color} leading-tight`}>{value.toLocaleString()}</span>
                    <span className="text-[10px] font-medium text-foreground">{label}</span>
                    <span className="text-[10px] text-muted-foreground">{sub}</span>
                  </div>
                ))}
              </div>

              {/* User status row */}
              <div className="grid grid-cols-3 gap-px bg-border">
                {[
                  { label: "Active", value: overview.users.active, color: "text-emerald-600", icon: ShieldCheck },
                  { label: "Pending", value: overview.users.pending, color: "text-amber-600", icon: CircleDot },
                  { label: "Banned", value: overview.users.banned, color: "text-destructive", icon: AlertCircle },
                ].map(({ label, value, color, icon: Icon }) => (
                  <div key={label} className="flex flex-col items-center gap-0.5 bg-background/60 py-2.5">
                    <Icon className={`h-3.5 w-3.5 ${color}`} />
                    <span className={`text-sm font-bold ${color}`}>{value}</span>
                    <span className="text-[10px] text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>

              {/* AI & activity footer */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <Bot className="h-3.5 w-3.5 text-violet-500" />
                  <span><strong className="text-foreground">{overview.ai_usage.recent_week}</strong> AI chats this week</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <MessageSquare className="h-3.5 w-3.5 text-primary" />
                  <span><strong className="text-foreground">{overview.ai_usage.total_chats}</strong> total</span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center px-4">
              <AlertCircle className="h-6 w-6 text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">Could not load platform data.</p>
            </div>
          )}
          </div>
        </GlassCard>

        {/* Quick Admin Queries */}
        <GlassCard interactive={false} className="p-0 overflow-hidden card-shadow flex-1">
          <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
              <Zap className="h-3.5 w-3.5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Quick Queries</h3>
              <p className="text-[11px] text-muted-foreground">Tap to ask instantly</p>
            </div>
          </div>
          <div className="p-3 space-y-1.5 max-h-64 overflow-y-auto scroll-styled">
            {[
              { icon: BarChart3, color: "text-violet-500 bg-violet-500/10", text: "Give me a full platform health summary" },
              { icon: ShieldAlert, color: "text-amber-500 bg-amber-500/10", text: "List all pending company and supplier approvals" },
              { icon: Users, color: "text-blue-500 bg-blue-500/10", text: "How many new users signed up this week vs last week?" },
              { icon: Building2, color: "text-primary bg-primary/10", text: "Which companies have the highest ratings and most completed projects?" },
              { icon: Package, color: "text-orange-500 bg-orange-500/10", text: "Which cities have too few suppliers vs company demand?" },
              { icon: TrendingUp, color: "text-emerald-500 bg-emerald-500/10", text: "What are current market prices for all construction materials?" },
              { icon: Activity, color: "text-rose-500 bg-rose-500/10", text: "What actions were most common in platform activity this week?" },
              { icon: Bot, color: "text-violet-500 bg-violet-500/10", text: "Show AI assistant usage trend and top question categories" },
            ].map(({ icon: Icon, color, text }) => (
              <button
                key={text}
                type="button"
                onClick={() => injectPrompt(text)}
                className="flex w-full items-start gap-3 rounded-xl border border-border/60 bg-background/30 p-3 hover:border-violet-500/20 hover:bg-violet-500/5 transition-all text-start group"
              >
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${color.split(" ")[1]}`}>
                  <Icon className={`h-3.5 w-3.5 ${color.split(" ")[0]}`} />
                </div>
                <p className="text-xs text-muted-foreground group-hover:text-foreground leading-relaxed transition-colors">{text}</p>
              </button>
            ))}
          </div>
        </GlassCard>
      </div>
    </motion.div>
  );
}
