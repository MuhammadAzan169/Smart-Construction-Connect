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
  Mic, Square, Play, RotateCcw, Check,
} from "lucide-react";

import { renderMarkdown } from "@/components/shared/MarkdownRenderer";
import { GlassCard } from "@/components/shared/GlassCard";
import { Button } from "@/components/ui/button";
import { api, QuoteRequest } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";

/* ── Types ──────────────────────────────────────────────────────── */
interface Message { id: number; role: "user" | "ai"; text: string; isStreaming?: boolean; }

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nextIdRef = useRef(1);
  const getNextId = useCallback(() => nextIdRef.current++, []);

  // Voice recorder
  const voice = useVoiceRecorder();
  const audioPreviewRef = useRef<HTMLAudioElement>(null);

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

  /* ── Send message (streaming) ── */
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

      if (currentFile) {
        const result = await api.ai.chatWithFile(currentFile, history, user?.email || "", "company");
        setMessages((prev) => [...prev, { id: getNextId(), role: "ai", text: result.response }]);
      } else {
        const streamMsgId = getNextId();
        setMessages((prev) => [...prev, { id: streamMsgId, role: "ai", text: "", isStreaming: true }]);
        let fullText = "";
        for await (const chunk of api.ai.chatStream(history, user?.email || "", "company")) {
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
          setMessages((prev) => prev.map((m) => m.id === streamMsgId ? { ...m, isStreaming: false } : m));
        }
      }
    } catch {
      setMessages((prev) => [...prev, { id: getNextId(), role: "ai", text: "Connection issue. Please try again." }]);
    } finally {
      setIsTyping(false);
    }
  }, [getNextId, input, isTyping, messages, user?.email, attachedFile]);

  /* ── Voice handling ── */
  const handleVoiceAccept = useCallback(() => {
    const text = voice.acceptTranscript();
    if (text.trim()) setInput(text);
  }, [voice]);

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
                  {msg.role === "ai" ? (
                    <>
                      {renderMarkdown(msg.text)}
                      {msg.isStreaming && <span className="inline-block w-1.5 h-4 ml-0.5 bg-emerald-500/60 animate-pulse rounded-sm" />}
                    </>
                  ) : msg.text}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Typing indicator */}
          {isTyping && !messages.some(m => m.isStreaming) && (
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
          {attachedFile && !voice.isRecording && !voice.isPreviewing && (
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
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.json,.txt,.md,.png,.jpg,.jpeg,.webp,.tiff,.bmp"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) { if (f.size > 10 * 1024 * 1024) { alert("File must be under 10 MB"); } else { setAttachedFile(f); } }
                e.target.value = "";
              }}
            />

            {/* Normal state: Attach + Mic buttons */}
            {!voice.isRecording && !voice.isPreviewing && (
              <>
                <motion.button type="button" onClick={() => fileInputRef.current?.click()} disabled={isTyping}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-secondary/40 text-muted-foreground hover:text-foreground hover:border-emerald-500/30 transition-colors disabled:opacity-40"
                  whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }} aria-label="Attach file">
                  <Paperclip className="h-4 w-4" />
                </motion.button>
                {(voice.isSupported || voice.isMediaSupported) && (
                  <motion.button type="button" onClick={() => voice.startRecording("auto")} disabled={isTyping}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-secondary/40 text-muted-foreground hover:text-foreground hover:border-emerald-500/30 transition-colors disabled:opacity-40"
                    whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }} aria-label="Start voice input">
                    <Mic className="h-4 w-4" />
                  </motion.button>
                )}
              </>
            )}

            {/* Recording state: compact inline waveform */}
            {voice.isRecording && (
              <>
                <div className="flex-1 flex items-center gap-2.5 rounded-2xl border border-red-500/40 bg-red-500/5 px-3 py-2 min-w-0">
                  <div className="flex items-end gap-[2px] shrink-0" style={{ height: 16 }}>
                    {[0.4, 1, 0.6, 0.9, 0.5].map((_, i) => (
                      <motion.span key={i} animate={{ scaleY: [0.35, 1, 0.35] }} transition={{ repeat: Infinity, duration: 0.55, delay: i * 0.1 }}
                        className="block w-[3px] rounded-full bg-red-500 origin-bottom h-full" />
                    ))}
                  </div>
                  <span className="text-xs font-semibold text-red-500 shrink-0 tabular-nums">{voice.duration}s</span>
                  <span className="flex-1 text-xs text-muted-foreground truncate italic min-w-0">{voice.transcript || "Listening…"}</span>
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
                    <motion.button type="button" onClick={() => audioPreviewRef.current?.play()}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/5 text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                      whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }} aria-label="Play recording">
                      <Play className="h-4 w-4" />
                    </motion.button>
                  </>
                )}
                <div className="flex-1 flex items-center rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-1 focus-within:border-emerald-500/50 transition-colors min-w-0">
                  <input value={voice.transcript} onChange={(e) => voice.setTranscript(e.target.value)}
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none min-w-0 py-1.5"
                    placeholder="Edit transcript before sending…"
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && voice.transcript.trim()) { e.preventDefault(); handleVoiceAccept(); } }}
                  />
                </div>
                <motion.button type="button" onClick={voice.cancelRecording}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-secondary/40 text-muted-foreground hover:text-foreground transition-colors"
                  whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }} aria-label="Re-record">
                  <RotateCcw className="h-4 w-4" />
                </motion.button>
                <motion.button type="button" onClick={handleVoiceAccept} disabled={!voice.transcript.trim()}
                  className="flex h-10 shrink-0 items-center gap-1.5 rounded-2xl bg-emerald-500 px-3 text-xs font-medium text-white shadow-sm disabled:opacity-40 transition-opacity"
                  whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }} aria-label="Use transcript">
                  <Check className="h-3.5 w-3.5" /> Use
                </motion.button>
              </>
            )}

            {/* Normal state: text input + send */}
            {!voice.isRecording && !voice.isPreviewing && (
              <>
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
              </>
            )}
          </form>
          <p className="mt-1.5 text-center text-[10px] text-muted-foreground/50">
            Enter to send · 📎 Attach files · 🎤 Voice input (English/Urdu) · AI may make mistakes
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
