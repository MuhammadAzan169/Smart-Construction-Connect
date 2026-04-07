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
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, User, Send, Paperclip, FileText, X,
  BarChart3, Bot, Building2, Package, Users, ShieldAlert,
  ShieldCheck, Zap, TrendingUp, Activity, ChevronRight,
  AlertCircle, CircleDot, MessageSquare, Mic, MicOff,
} from "lucide-react";

import { GlassCard } from "@/components/shared/GlassCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";

/* ── Markdown renderer ─────────────────────────────────────────────── */
function renderMd(text: string) {
  const lines = text.split("\n");
  const els: React.ReactNode[] = [];
  let listItems: { ordered: boolean; text: string }[] = [];
  let tableRows: string[][] = [];
  let tableHeader: string[] | null = null;

  const fmt = (s: string): React.ReactNode => {
    const p: React.ReactNode[] = [];
    let last = 0;
    const rx = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
    let m;
    while ((m = rx.exec(s)) !== null) {
      if (m.index > last) p.push(s.slice(last, m.index));
      if (m[2]) p.push(<strong key={m.index} className="font-semibold">{m[2]}</strong>);
      else if (m[3]) p.push(<em key={m.index}>{m[3]}</em>);
      else if (m[4]) p.push(<code key={m.index} className="rounded bg-muted px-1 py-0.5 text-xs font-mono">{m[4]}</code>);
      last = m.index + m[0].length;
    }
    if (last < s.length) p.push(s.slice(last));
    return p.length === 1 ? p[0] : <>{p}</>;
  };

  const flushList = () => {
    if (!listItems.length) return;
    const ordered = listItems[0].ordered;
    const Tag = ordered ? "ol" : "ul";
    els.push(
      <Tag key={`l-${els.length}`} className={`my-1.5 ml-4 space-y-0.5 ${ordered ? "list-decimal" : "list-disc"}`}>
        {listItems.map((li, i) => <li key={i} className="text-sm leading-relaxed">{fmt(li.text)}</li>)}
      </Tag>
    );
    listItems = [];
  };

  const flushTable = () => {
    if (!tableHeader && !tableRows.length) return;
    const headers = tableHeader || [];
    els.push(
      <div key={`t-${els.length}`} className="my-2 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          {headers.length > 0 && (
            <thead><tr className="border-b border-border bg-muted/50">
              {headers.map((h, i) => <th key={i} className="px-3 py-2 text-left font-semibold text-foreground">{fmt(h.trim())}</th>)}
            </tr></thead>
          )}
          <tbody>
            {tableRows.map((row, ri) => (
              <tr key={ri} className={ri % 2 === 0 ? "" : "bg-muted/20"}>
                {row.map((cell, ci) => <td key={ci} className="px-3 py-2 text-muted-foreground border-t border-border/50">{fmt(cell.trim())}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableHeader = null;
    tableRows = [];
  };

  const parseRow = (line: string) => {
    if (!line.trim().startsWith("|")) return null;
    return line.split("|").slice(1, -1);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const tRow = parseRow(line);
    if (tRow !== null) {
      if (tRow.every(c => /^[-: ]+$/.test(c))) continue;
      if (tableHeader === null) { flushList(); tableHeader = tRow; }
      else tableRows.push(tRow);
      continue;
    }
    flushTable();
    const bm = line.match(/^\s*[-•*]\s+(.*)/);
    if (bm) { listItems.push({ ordered: false, text: bm[1] }); continue; }
    const nm = line.match(/^\s*\d+[.)]\s+(.*)/);
    if (nm) { listItems.push({ ordered: true, text: nm[1] }); continue; }
    flushList();
    const h3 = line.match(/^###\s+(.*)/);
    if (h3) { els.push(<h4 key={i} className="mt-3 mb-1 text-sm font-bold text-foreground border-l-2 border-violet-500 pl-2">{fmt(h3[1])}</h4>); continue; }
    const h2 = line.match(/^##\s+(.*)/);
    if (h2) { els.push(<h3 key={i} className="mt-3 mb-1 text-base font-bold text-foreground">{fmt(h2[1])}</h3>); continue; }
    const h1 = line.match(/^#\s+(.*)/);
    if (h1) { els.push(<h3 key={i} className="mt-3 mb-1 text-base font-bold text-foreground">{fmt(h1[1])}</h3>); continue; }
    if (/^[-*_]{3,}$/.test(line.trim())) { els.push(<hr key={i} className="my-2 border-border" />); continue; }
    if (!line.trim()) { els.push(<div key={i} className="h-2" />); continue; }
    els.push(<p key={i} className="text-sm leading-relaxed">{fmt(line)}</p>);
  }
  flushList();
  flushTable();
  return <div className="space-y-0.5">{els}</div>;
}

/* ── Types ─────────────────────────────────────────────────────────── */
interface Message { id: number; role: "user" | "ai"; text: string; }

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
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  /* ── Chat state ── */
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const nextIdRef = useRef(1);
  const getNextId = useCallback(() => nextIdRef.current++, []);

  /* ── Platform data state ── */
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loadingOv, setLoadingOv] = useState(true);

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

  /* ── Send ── */
  const handleSend = useCallback(async () => {
    const text = input.trim();
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

      let result: { response: string; recommendations?: unknown[] };
      if (currentFile) {
        result = await api.ai.chatWithFile(currentFile, history, user?.email || "", "admin");
      } else {
        result = await api.ai.chat(history, user?.email || "", "admin");
      }
      setMessages((prev) => [...prev, { id: getNextId(), role: "ai", text: result.response }]);
    } catch {
      setMessages((prev) => [...prev, { id: getNextId(), role: "ai", text: "Connection issue. Please try again." }]);
    } finally {
      setIsTyping(false);
    }
  }, [getNextId, input, isTyping, messages, user?.email, attachedFile]);

  /* ── Voice recording ── */
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const audioFile = new File([audioBlob], `voice-note-${Date.now()}.wav`, { type: 'audio/wav' });
        setAttachedFile(audioFile);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

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
      className="flex h-[calc(100vh-5rem)] gap-5"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      {/* ═══════════════════════════════════════════════════════════
          Left: Chat Panel
      ═══════════════════════════════════════════════════════════ */}
      <GlassCard interactive={false} className="flex flex-1 flex-col p-0 overflow-hidden card-shadow">

        {/* Header */}
        <div className="relative flex items-center gap-3 border-b border-border px-5 py-4 overflow-hidden">
          <div className="absolute left-0 top-0 h-full w-40 bg-gradient-to-r from-violet-500/8 to-transparent pointer-events-none" />
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
            <h2 className="text-sm font-bold text-foreground leading-tight">AI Analytics Assistant</h2>
            <p className="text-[11px] text-muted-foreground leading-tight">Platform data · User insights · Market intelligence</p>
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
          className="flex-1 overflow-y-auto px-5 py-5 space-y-3"
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
                  className="rounded-xl border border-violet-500/20 bg-violet-500/5 px-3 py-1.5 text-xs text-muted-foreground hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-foreground transition-colors text-left"
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
                  className={`max-w-[76%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                    msg.role === "ai"
                      ? "bg-secondary text-foreground rounded-bl-md"
                      : "bg-violet-500 text-white rounded-br-md"
                  }`}
                  dir="auto"
                >
                  {msg.role === "ai" ? renderMd(msg.text) : msg.text}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {isTyping && (
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
          {attachedFile && (
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
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.json,.txt,.md,.png,.jpg,.jpeg,.webp"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) { if (f.size > 5 * 1024 * 1024) alert("File must be under 5 MB"); else setAttachedFile(f); }
                e.target.value = "";
              }}
            />
            <motion.button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isTyping}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-secondary/40 text-muted-foreground hover:text-foreground hover:border-violet-500/30 transition-colors disabled:opacity-40"
              whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
            >
              <Paperclip className="h-4 w-4" />
            </motion.button>
            <motion.button type="button" onClick={toggleRecording} disabled={isTyping}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition-colors disabled:opacity-40 ${
                isRecording
                  ? "border-red-500/40 bg-red-500/10 text-red-500 animate-pulse"
                  : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground hover:border-violet-500/30"
              }`}
              whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }} aria-label="Record voice note">
              {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </motion.button>
            <div className="flex-1 flex items-center gap-2 rounded-2xl border border-border bg-secondary/40 px-4 py-1 focus-within:border-violet-500/40 transition-colors">
              <input
                id="admin-chat-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={attachedFile ? "Add a message about the file..." : "Ask about platform data, users, analytics, approvals…"}
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none focus:outline-none min-w-0 py-2"
                disabled={isTyping}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              />
            </div>
            <motion.button
              type="submit"
              disabled={(!input.trim() && !attachedFile) || isTyping}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-500 text-white shadow-sm disabled:opacity-40"
              whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
            >
              <Send className="h-4 w-4" />
            </motion.button>
          </form>
          <p className="mt-1.5 text-center text-[10px] text-muted-foreground/50">
            Enter to send · 📎 Attach reports or data files · 🎤 Record voice note · AI uses live platform data
          </p>
        </div>
      </GlassCard>

      {/* ═══════════════════════════════════════════════════════════
          Right: Platform Command Center
      ═══════════════════════════════════════════════════════════ */}
      <div className="hidden lg:flex w-80 flex-col gap-3">

        {/* Platform stats */}
        <GlassCard interactive={false} className="p-0 overflow-hidden card-shadow">
          <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
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
                    Review <ChevronRight className="h-3 w-3 ml-0.5" />
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
          <div className="p-3 space-y-1.5 overflow-y-auto">
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
                className="flex w-full items-start gap-3 rounded-xl border border-border/60 bg-background/30 p-3 hover:border-violet-500/20 hover:bg-violet-500/5 transition-all text-left group"
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
