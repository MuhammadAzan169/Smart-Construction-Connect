/**
 * CompanyAIChatPage — AI Business Advisor for construction companies.
 *
 * Right panel: Business Intelligence
 *  • Company profile snapshot (verified status, packages, service areas)
 *  • Request pipeline (pending / accepted / completed breakdown)
 *  • Recent client requests list
 *  • Quick-access to manage packages / view requests
 *  • Company-focused quick query shortcuts
 *
 * Chat: same bilingual engine as AIChatPage but role="company" hardcoded.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Bot, User, Send, Paperclip, FileText, X,
  Briefcase, Building2, Package, MapPin, Clock, CheckCircle2,
  XCircle, FileCheck, ShieldCheck, ArrowRight, Layers, CreditCard,
  Mic, MicOff,
} from "lucide-react";

import { GlassCard } from "@/components/shared/GlassCard";
import { Button } from "@/components/ui/button";
import { api, QuoteRequest } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";

/* ── Markdown renderer ───────────────────────────────────────────── */
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
    if (h3) { els.push(<h4 key={i} className="mt-3 mb-1 text-sm font-bold text-foreground border-l-2 border-emerald-500 pl-2">{fmt(h3[1])}</h4>); continue; }
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

/* ── Types ──────────────────────────────────────────────────────── */
interface Message { id: number; role: "user" | "ai"; text: string; }

/* ── Suggested prompts ──────────────────────────────────────────── */
const COMPANY_PROMPTS = [
  "Find best cement and steel suppliers in Lahore right now",
  "What are current market prices for construction materials?",
  "Compare top-rated material suppliers in Islamabad",
  "Help me estimate the cost for a 10 marla house grey structure",
  "Which suppliers offer the best bulk discount rates?",
  "What materials should I stockpile before the construction season?",
  "Suggest cost-saving alternatives for steel reinforcement",
  "Help me draft a material procurement plan for a 5 marla commercial project",
];

const STATUS_META = {
  pending:   { label: "Pending",   color: "text-amber-500",  bg: "bg-amber-500/10",   icon: Clock },
  accepted:  { label: "Accepted",  color: "text-emerald-500", bg: "bg-emerald-500/10", icon: CheckCircle2 },
  rejected:  { label: "Rejected",  color: "text-red-500",    bg: "bg-red-500/10",     icon: XCircle },
  completed: { label: "Done",      color: "text-emerald-600", bg: "bg-emerald-600/10", icon: FileCheck },
} as const;

/* ══════════════════════════════════════════════════════════════════
   Main Page
══════════════════════════════════════════════════════════════════ */
export default function CompanyAIChatPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const companySlug = user?.companyFile ?? "";

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

  /* ── Business Intel sidebar state ── */
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [requests, setRequests] = useState<QuoteRequest[]>([]);
  const [loadingBiz, setLoadingBiz] = useState(true);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  /* ── Load greeting ── */
  useEffect(() => {
    api.ai.chat([], user?.email || "", "company").then((res) => {
      setMessages([{ id: getNextId(), role: "ai", text: res.response }]);
    }).catch(() => {
      setMessages([{ id: getNextId(), role: "ai", text: "Hello! 🏗️ I'm your AI Business Advisor. Ask me about material sourcing, cost estimation, supplier comparisons, or market pricing to help your projects succeed." }]);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Load business intel data ── */
  useEffect(() => {
    const load = async () => {
      try {
        const [reqs, prof] = await Promise.all([
          api.requests.list().catch(() => [] as QuoteRequest[]),
          companySlug ? api.companies.getProfile(companySlug).catch(() => null) : Promise.resolve(null),
        ]);
        setRequests(reqs);
        setProfile(prof);
      } finally {
        setLoadingBiz(false);
      }
    };
    load();
  }, [companySlug]);

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

  /* ── Send message ── */
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

      let result: { response: string };
      if (currentFile) {
        result = await api.ai.chatWithFile(currentFile, history, user?.email || "", "company");
      } else {
        result = await api.ai.chat(history, user?.email || "", "company");
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

  /* ── Derived business intel ── */
  const bizStats = useMemo(() => {
    const scope = profile?.package_scope as Record<string, unknown> | undefined;
    const activePackages = scope ? Object.keys(scope).length : 0;
    const areas = (profile?.flattened_operational_areas as { city?: string }[] | undefined) ?? [];
    const coveredCities = new Set(areas.map((r) => r.city).filter(Boolean)).size;
    const isVerified = profile?.verification_status === "verified";
    const companyName = (profile?.company_name as string) ?? user?.display_name ?? "Your Company";
    const totalReqs = requests.length;
    const pending = requests.filter((r) => r.status === "pending").length;
    const accepted = requests.filter((r) => r.status === "accepted").length;
    const completed = requests.filter((r) => r.status === "completed").length;
    return { activePackages, coveredCities, isVerified, companyName, totalReqs, pending, accepted, completed };
  }, [profile, requests, user?.display_name]);

  const recentRequests = useMemo(() => requests.slice(0, 4), [requests]);

  const injectPrompt = (s: string) => {
    setInput(s);
    const el = document.getElementById("company-chat-input");
    if (el) (el as HTMLInputElement).focus();
  };

  if (!user || user.role !== "company") {
    return (
      <GlassCard interactive={false} className="p-6">
        <p className="text-sm text-muted-foreground">This page is only available to construction company accounts.</p>
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
      {/* ═══════════════════════════════════════════════════════
          Left: Chat Panel
      ═══════════════════════════════════════════════════════ */}
      <GlassCard interactive={false} className="flex flex-1 flex-col p-0 overflow-hidden card-shadow">

        {/* Header */}
        <div className="relative flex items-center gap-3 border-b border-border px-5 py-4 overflow-hidden">
          <div className="absolute left-0 top-0 h-full w-40 bg-gradient-to-r from-emerald-500/8 to-transparent pointer-events-none" />
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="relative flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 shadow-md">
            <Briefcase className="h-5 w-5 text-white" />
            <div className="absolute inset-0 rounded-xl ring-2 ring-emerald-500/30" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground leading-tight">AI Business Advisor</h2>
            <p className="text-[11px] text-muted-foreground leading-tight">Material sourcing · Cost estimation · Market intelligence</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
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
              {COMPANY_PROMPTS.slice(0, 4).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => injectPrompt(s)}
                  className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 text-xs text-muted-foreground hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-foreground transition-colors text-left"
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
                  msg.role === "ai" ? "bg-emerald-500" : "bg-secondary border border-border"
                }`}>
                  {msg.role === "ai" ? <Briefcase className="h-4 w-4 text-white" /> : <User className="h-4 w-4 text-muted-foreground" />}
                </div>
                <div
                  className={`max-w-[76%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                    msg.role === "ai"
                      ? "bg-secondary text-foreground rounded-bl-md"
                      : "bg-emerald-500 text-white rounded-br-md"
                  }`}
                  dir="auto"
                >
                  {msg.role === "ai" ? renderMd(msg.text) : msg.text}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Typing indicator */}
          {isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex items-end gap-2.5"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500 shadow-sm">
                <Briefcase className="h-4 w-4 text-white" />
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
            <div className="mb-2 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
              <FileText className="h-4 w-4 text-emerald-500 shrink-0" />
              <span className="flex-1 truncate text-xs text-foreground">{attachedFile.name}</span>
              <span className="text-[10px] text-muted-foreground">{(attachedFile.size / 1024).toFixed(0)} KB</span>
              <button type="button" onClick={() => setAttachedFile(null)} className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-secondary transition-colors" aria-label="Remove file">
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
            </div>
          )}
          <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); handleSend(); }}>
            <input ref={fileInputRef} type="file" className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.json,.txt,.md,.png,.jpg,.jpeg,.webp"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) { if (f.size > 5 * 1024 * 1024) { alert("File must be under 5 MB"); } else { setAttachedFile(f); } }
                e.target.value = "";
              }}
            />
            <motion.button type="button" onClick={() => fileInputRef.current?.click()} disabled={isTyping}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-secondary/40 text-muted-foreground hover:text-foreground hover:border-emerald-500/30 transition-colors disabled:opacity-40"
              whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }} aria-label="Attach file">
              <Paperclip className="h-4 w-4" />
            </motion.button>
            <motion.button type="button" onClick={toggleRecording} disabled={isTyping}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition-colors disabled:opacity-40 ${
                isRecording
                  ? "border-red-500/40 bg-red-500/10 text-red-500 animate-pulse"
                  : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground hover:border-emerald-500/30"
              }`}
              whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }} aria-label="Record voice note">
              {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </motion.button>
            <div className="flex-1 flex items-center gap-2 rounded-2xl border border-border bg-secondary/40 px-4 py-1 focus-within:border-emerald-500/40 transition-colors">
              <input
                id="company-chat-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about material prices, suppliers, cost estimates..."
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none focus:outline-none min-w-0 py-2"
                disabled={isTyping}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              />
            </div>
            <motion.button type="submit" disabled={(!input.trim() && !attachedFile) || isTyping}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-sm disabled:opacity-40 transition-opacity"
              whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }} aria-label="Send message">
              <Send className="h-4 w-4" />
            </motion.button>
          </form>
          <p className="mt-1.5 text-center text-[10px] text-muted-foreground/50">
            Enter to send · 📎 Attach files · 🎤 Record voice note · AI may make mistakes
          </p>
        </div>
      </GlassCard>

      {/* ═══════════════════════════════════════════════════════
          Right: Business Intelligence Panel
      ═══════════════════════════════════════════════════════ */}
      <div className="hidden lg:flex w-80 flex-col gap-3">

        {/* Company snapshot */}
        <GlassCard interactive={false} className="flex flex-col p-0 overflow-hidden card-shadow">
          <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
              <Layers className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-foreground leading-tight">Business Intelligence</h3>
              <p className="text-[11px] text-muted-foreground leading-tight">Company snapshot + request pipeline</p>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* Company header row */}
            <div className="flex items-center gap-3 rounded-xl border border-emerald-500/10 bg-emerald-500/5 px-3 py-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15">
                <Building2 className="h-5 w-5 text-emerald-500" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{bizStats.companyName}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {bizStats.isVerified ? (
                    <><ShieldCheck className="h-3 w-3 text-emerald-500" /><span className="text-[10px] text-emerald-500 font-medium">Verified</span></>
                  ) : (
                    <><ShieldCheck className="h-3 w-3 text-muted-foreground/40" /><span className="text-[10px] text-muted-foreground">Unverified</span></>
                  )}
                </div>
              </div>
            </div>

            {/* Profile stats */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-secondary/60 px-3 py-2.5 text-center">
                <p className="text-xl font-bold text-emerald-500">{loadingBiz ? "…" : bizStats.activePackages || "—"}</p>
                <div className="flex items-center justify-center gap-1 mt-0.5">
                  <Package className="h-3 w-3 text-muted-foreground/60" />
                  <p className="text-[10px] text-muted-foreground">Packages</p>
                </div>
              </div>
              <div className="rounded-xl bg-secondary/60 px-3 py-2.5 text-center">
                <p className="text-xl font-bold text-emerald-500">{loadingBiz ? "…" : bizStats.coveredCities || "—"}</p>
                <div className="flex items-center justify-center gap-1 mt-0.5">
                  <MapPin className="h-3 w-3 text-muted-foreground/60" />
                  <p className="text-[10px] text-muted-foreground">Cities</p>
                </div>
              </div>
            </div>

            {/* Request pipeline */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Request Pipeline</p>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { label: "Total", value: bizStats.totalReqs, color: "text-foreground", bg: "bg-secondary/80" },
                  { label: "Pending", value: bizStats.pending, color: "text-amber-500", bg: "bg-amber-500/8" },
                  { label: "Active", value: bizStats.accepted, color: "text-emerald-500", bg: "bg-emerald-500/8" },
                  { label: "Done", value: bizStats.completed, color: "text-sky-500", bg: "bg-sky-500/8" },
                ].map(({ label, value, color, bg }) => (
                  <div key={label} className={`rounded-xl ${bg} px-1.5 py-2 text-center`}>
                    <p className={`text-base font-bold ${color}`}>{loadingBiz ? "…" : value}</p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent requests */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Recent Requests</p>
                <Link to="/requests" className="text-[10px] text-emerald-500 hover:underline flex items-center gap-0.5">
                  View all <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              {loadingBiz ? (
                <p className="text-xs text-muted-foreground py-3 text-center">Loading…</p>
              ) : recentRequests.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border py-4 text-center">
                  <Building2 className="h-5 w-5 text-muted-foreground/30 mx-auto mb-1" />
                  <p className="text-xs text-muted-foreground">No client requests yet</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {recentRequests.map((req, i) => {
                    const meta = STATUS_META[req.status] ?? STATUS_META.pending;
                    const StatusIcon = meta.icon;
                    return (
                      <motion.div
                        key={req.id}
                        initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                        className="flex items-center gap-2 rounded-xl border border-border bg-secondary/30 px-3 py-2"
                      >
                        <StatusIcon className={`h-3.5 w-3.5 shrink-0 ${meta.color}`} />
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-xs font-medium text-foreground">{req.client_name || "—"}</p>
                          <p className="truncate text-[10px] text-muted-foreground">{req.project_title || "—"}</p>
                        </div>
                        <span className={`text-[10px] font-semibold ${meta.color}`}>{meta.label}</span>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button asChild size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs h-8 gap-1.5">
                <Link to="/pricing"><CreditCard className="h-3.5 w-3.5" /> Packages</Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="text-xs h-8 gap-1.5 border-emerald-500/20 hover:border-emerald-500/40">
                <Link to="/requests"><FileCheck className="h-3.5 w-3.5" /> Requests</Link>
              </Button>
            </div>
          </div>
        </GlassCard>

        {/* Quick Queries */}
        <GlassCard interactive={false} className="flex flex-col p-0 overflow-hidden card-shadow">
          <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
              <Bot className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground leading-tight">Quick Queries</h3>
              <p className="text-[11px] text-muted-foreground leading-tight">Tap to ask instantly</p>
            </div>
          </div>
          <div className="p-3 space-y-1.5">
            {COMPANY_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => injectPrompt(prompt)}
                className="w-full flex items-center gap-2.5 rounded-xl border border-border bg-secondary/30 px-3 py-2 text-left hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all group"
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500/50 group-hover:bg-emerald-500 transition-colors" />
                <span className="text-[11px] text-muted-foreground group-hover:text-foreground transition-colors leading-snug line-clamp-2">{prompt}</span>
              </button>
            ))}
          </div>
        </GlassCard>
      </div>
    </motion.div>
  );
}
