/**
 * SupplierAIChatPage — AI Market Analyst for material suppliers.
 *
 * Right panel: Inventory Intelligence
 *  • Live inventory stats from the supplier's own profile
 *  • Category breakdown & low-stock alerts
 *  • Quick query shortcuts focused on pricing & demand
 *
 * Chat: same bilingual engine as AIChatPage but role="supplier" hardcoded.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Bot, User, Send, Paperclip, FileText, X,
  Package, TrendingUp, TrendingDown, AlertTriangle, BarChart2,
  Zap, ChevronRight, Layers, ShoppingCart, Tag, BadgeDollarSign,
  Mic, Square, Play, RotateCcw, Check,
} from "lucide-react";

import { renderMarkdown } from "@/components/shared/MarkdownRenderer";
import { GlassCard } from "@/components/shared/GlassCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";

/* ── Types ─────────────────────────────────────────────────────────── */
interface Message { id: number; role: "user" | "ai"; text: string; isStreaming?: boolean; }

interface MatItem {
  name: string;
  category: string;
  price: number;
  unit: string;
  stock: number;
  image_urls?: string[];
}

/* ── Suggested prompts ─────────────────────────────────────────────── */
const SUPPLIER_PROMPTS = [
  "Am I pricing my cement competitively in Lahore?",
  "Which construction materials are highest in demand this season?",
  "Compare my steel prices with current market averages",
  "What's the best price strategy for bulk orders?",
  "Which cities have the most construction activity right now?",
  "Help me analyze which products to add to my inventory",
  "What are the current market prices for all materials?",
  "My stock of bricks is low — should I reorder now?",
];

const formatPKR = (n: number) =>
  new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(n);

/* ══════════════════════════════════════════════════════════════════════
   Main Page
══════════════════════════════════════════════════════════════════════ */
export default function SupplierAIChatPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const supplierSlug = user?.supplierFile;

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

  /* ── Inventory sidebar state ── */
  const [materials, setMaterials] = useState<MatItem[]>([]);
  const [loadingInv, setLoadingInv] = useState(true);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  /* ── Load greeting ── */
  useEffect(() => {
    api.ai.chat([], user?.email || "", "supplier").then((res) => {
      setMessages([{ id: getNextId(), role: "ai", text: res.response }]);
    }).catch(() => {
      setMessages([{ id: getNextId(), role: "ai", text: "Hello! 📊 I'm your AI Market Analyst. Ask me about pricing strategies, demand trends, or competitive analysis." }]);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Load inventory ── */
  useEffect(() => {
    if (!supplierSlug) { setLoadingInv(false); return; }
    api.suppliers.getProfile(supplierSlug).then((data: any) => {
      const mats: MatItem[] = (data.materials ?? []).map((m: any) => ({
        name: m.name ?? "",
        category: m.category ?? "",
        price: typeof m.price === "number" ? m.price : 0,
        unit: m.unit ?? "",
        stock: typeof m.stock === "number" ? m.stock : 0,
        image_urls: Array.isArray(m.image_urls) ? m.image_urls : [],
      }));
      setMaterials(mats);
    }).catch(() => {}).finally(() => setLoadingInv(false));
  }, [supplierSlug]);

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

  /* ── Send (streaming) ── */
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
        const result = await api.ai.chatWithFile(currentFile, history, user?.email || "", "supplier");
        setMessages((prev) => [...prev, { id: getNextId(), role: "ai", text: result.response }]);
      } else {
        const streamMsgId = getNextId();
        setMessages((prev) => [...prev, { id: streamMsgId, role: "ai", text: "", isStreaming: true }]);
        let fullText = "";
        for await (const chunk of api.ai.chatStream(history, user?.email || "", "supplier")) {
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

  /* ── Inventory-derived stats ── */
  const invStats = useMemo(() => {
    const LOW = 50;
    const total = materials.length;
    const lowStock = materials.filter((m) => m.stock <= LOW && m.stock > 0).length;
    const outOfStock = materials.filter((m) => m.stock === 0).length;
    const categories = [...new Set(materials.map((m) => m.category).filter(Boolean))];
    const topByPrice = [...materials].sort((a, b) => b.price - a.price).slice(0, 5);
    const catBreakdown = categories.map((cat) => ({
      cat,
      count: materials.filter((m) => m.category === cat).length,
    })).sort((a, b) => b.count - a.count).slice(0, 6);
    return { total, lowStock, outOfStock, categories: categories.length, topByPrice, catBreakdown };
  }, [materials]);

  /* ── Inject suggestion into input ── */
  const injectPrompt = (s: string) => {
    setInput(s);
    const el = document.getElementById("supplier-chat-input");
    if (el) (el as HTMLInputElement).focus();
  };

  if (!user || user.role !== "supplier") {
    return (
      <GlassCard interactive={false} className="p-6">
        <p className="text-sm text-muted-foreground">This page is only available to supplier accounts.</p>
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
          <div className="absolute left-0 top-0 h-full w-40 bg-gradient-to-r from-orange-500/8 to-transparent pointer-events-none" />
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="relative flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500 shadow-md">
            <BarChart2 className="h-5 w-5 text-white" />
            <div className="absolute inset-0 rounded-xl ring-2 ring-orange-500/30" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground leading-tight">AI Market Analyst</h2>
            <p className="text-[11px] text-muted-foreground leading-tight">Pricing strategy · Demand insights · Competitive analysis</p>
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
              {SUPPLIER_PROMPTS.slice(0, 4).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => injectPrompt(s)}
                  className="rounded-xl border border-orange-500/20 bg-orange-500/5 px-3 py-1.5 text-xs text-muted-foreground hover:border-orange-500/40 hover:bg-orange-500/10 hover:text-foreground transition-colors text-left"
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
                  msg.role === "ai" ? "bg-orange-500" : "bg-secondary border border-border"
                }`}>
                  {msg.role === "ai" ? <BarChart2 className="h-4 w-4 text-white" /> : <User className="h-4 w-4 text-muted-foreground" />}
                </div>
                <div
                  className={`max-w-[76%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                    msg.role === "ai"
                      ? "bg-secondary text-foreground rounded-bl-md"
                      : "bg-orange-500 text-white rounded-br-md"
                  }`}
                  dir="auto"
                >
                  {msg.role === "ai" ? (
                    <>
                      {renderMarkdown(msg.text)}
                      {msg.isStreaming && (
                        <span className="ml-1 inline-block h-4 w-1.5 rounded-sm bg-orange-500 animate-pulse" />
                      )}
                    </>
                  ) : msg.text}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {isTyping && !messages.some(m => m.isStreaming) && (
            <motion.div
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex items-end gap-2.5"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange-500 shadow-sm">
                <BarChart2 className="h-4 w-4 text-white" />
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
            <div className="mb-2 flex items-center gap-2 rounded-xl border border-orange-500/20 bg-orange-500/5 px-3 py-2">
              <FileText className="h-4 w-4 text-orange-500 shrink-0" />
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

            {/* Normal state: Attach + Mic buttons */}
            {!voice.isRecording && !voice.isPreviewing && (
              <>
                <motion.button type="button" onClick={() => fileInputRef.current?.click()} disabled={isTyping}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-secondary/40 text-muted-foreground hover:text-foreground hover:border-orange-500/30 transition-colors disabled:opacity-40"
                  whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}>
                  <Paperclip className="h-4 w-4" />
                </motion.button>
                {voice.isSupported && (
                  <motion.button type="button" onClick={() => voice.startRecording("auto")} disabled={isTyping}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-secondary/40 text-muted-foreground hover:text-foreground hover:border-orange-500/30 transition-colors disabled:opacity-40"
                    whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }} aria-label="Record voice">
                    <Mic className="h-4 w-4" />
                  </motion.button>
                )}
              </>
            )}

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
                  <span className="flex-1 text-xs text-muted-foreground italic min-w-0 break-words">{voice.transcript || "Listening…"}</span>
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
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-orange-500/30 bg-orange-500/5 text-orange-500 hover:bg-orange-500/10 transition-colors"
                      whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }} aria-label="Play recording">
                      <Play className="h-4 w-4" />
                    </motion.button>
                  </>
                )}
                <div className="flex-1 flex items-start rounded-2xl border border-orange-500/30 bg-orange-500/5 px-3 py-1 focus-within:border-orange-500/50 transition-colors min-w-0">
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
                  className="flex h-10 shrink-0 items-center gap-1.5 rounded-2xl bg-orange-500 px-3 text-xs font-medium text-white shadow-sm disabled:opacity-40 transition-opacity"
                  whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }} aria-label="Use transcript">
                  <Check className="h-3.5 w-3.5" /> Use
                </motion.button>
              </>
            )}

            {/* Normal state: text input + send */}
            {!voice.isRecording && !voice.isPreviewing && (
              <>
                <div className="flex-1 flex items-center gap-2 rounded-2xl border border-border bg-secondary/40 px-4 py-1 focus-within:border-orange-500/40 transition-colors">
                  <input
                    id="supplier-chat-input"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={attachedFile ? "Add a message about the file..." : "Ask about prices, demand trends, competitive analysis…"}
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none focus:outline-none min-w-0 py-2"
                    disabled={isTyping}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  />
                </div>
                <motion.button type="submit" disabled={(!input.trim() && !attachedFile) || isTyping}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-sm disabled:opacity-40"
                  whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}>
                  <Send className="h-4 w-4" />
                </motion.button>
              </>
            )}
          </form>
          <p className="mt-1.5 text-center text-[10px] text-muted-foreground/50">
            Enter to send · 📎 Attach price sheets, inventory files · 🎤 Voice input · AI may make mistakes
          </p>
        </div>
      </GlassCard>

      {/* ═══════════════════════════════════════════════════════════
          Right: Inventory Intelligence Panel
      ═══════════════════════════════════════════════════════════ */}
      <div className="hidden lg:flex w-80 flex-col gap-3">

        {/* Inventory stats */}
        <GlassCard interactive={false} className="p-0 overflow-hidden card-shadow">
          <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500/10">
              <Package className="h-3.5 w-3.5 text-orange-500" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-foreground">Inventory Overview</h3>
              <p className="text-[11px] text-muted-foreground">{invStats.total} products · {invStats.categories} categories</p>
            </div>
          </div>

          {loadingInv ? (
            <div className="flex items-center justify-center py-8">
              <Bot className="h-5 w-5 animate-pulse text-muted-foreground/30" />
            </div>
          ) : invStats.total === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 px-4 text-center">
              <Package className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground">No inventory found. Add materials first.</p>
              <Button
                type="button" variant="outline" size="sm" className="mt-1 text-xs"
                onClick={() => navigate("/products")}
              >
                Go to Inventory
              </Button>
            </div>
          ) : (
            <>
              {/* KPI row */}
              <div className="grid grid-cols-3 gap-px bg-border">
                {[
                  { icon: Package, label: "Products", value: invStats.total, color: "text-primary" },
                  { icon: AlertTriangle, label: "Low Stock", value: invStats.lowStock, color: "text-amber-500" },
                  { icon: TrendingDown, label: "Out of Stock", value: invStats.outOfStock, color: "text-destructive" },
                ].map(({ icon: Icon, label, value, color }) => (
                  <div key={label} className="flex flex-col items-center gap-0.5 bg-background/60 py-3">
                    <Icon className={`h-4 w-4 ${color}`} />
                    <span className={`text-base font-bold ${color}`}>{value}</span>
                    <span className="text-[10px] text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>

              {/* Category breakdown */}
              {invStats.catBreakdown.length > 0 && (
                <div className="px-4 py-3 space-y-1.5 border-t border-border">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">By Category</p>
                  {invStats.catBreakdown.map(({ cat, count }) => {
                    const pct = Math.round((count / invStats.total) * 100);
                    return (
                      <div key={cat} className="space-y-0.5">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-foreground truncate max-w-[160px]">{cat}</span>
                          <span className="text-muted-foreground shrink-0 ml-1">{count}</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <motion.div
                            className="h-full rounded-full bg-orange-500/70"
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.6, delay: 0.1 }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Top priced materials */}
              {invStats.topByPrice.length > 0 && (
                <div className="px-4 pb-3 border-t border-border">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-3 mb-2">Top by Price</p>
                  <div className="space-y-2">
                    {invStats.topByPrice.slice(0, 3).map((m, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-500/10">
                          {m.image_urls?.[0]
                            ? <img src={m.image_urls[0]} alt={m.name} className="h-8 w-8 rounded-lg object-cover" />
                            : <Tag className="h-3.5 w-3.5 text-orange-500" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{m.name}</p>
                          <p className="text-[10px] text-muted-foreground">{m.category}</p>
                        </div>
                        <span className="text-xs font-bold text-foreground shrink-0">{formatPKR(m.price)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Alerts */}
              {(invStats.lowStock > 0 || invStats.outOfStock > 0) && (
                <div className="mx-4 mb-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 space-y-1">
                  {invStats.outOfStock > 0 && (
                    <div className="flex items-center gap-2 text-xs text-destructive">
                      <TrendingDown className="h-3.5 w-3.5 shrink-0" />
                      <span><strong>{invStats.outOfStock}</strong> product{invStats.outOfStock > 1 ? "s" : ""} out of stock</span>
                    </div>
                  )}
                  {invStats.lowStock > 0 && (
                    <div className="flex items-center gap-2 text-xs text-amber-600">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span><strong>{invStats.lowStock}</strong> product{invStats.lowStock > 1 ? "s" : ""} running low</span>
                    </div>
                  )}
                  <Button
                    type="button" variant="ghost" size="sm"
                    className="h-7 mt-1 w-full text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
                    onClick={() => navigate("/products")}
                  >
                    Manage Inventory <ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              )}
            </>
          )}
        </GlassCard>

        {/* Quick AI Queries */}
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
              { icon: BadgeDollarSign, color: "text-emerald-500 bg-emerald-500/10", text: "What are current cement prices across Pakistan?" },
              { icon: TrendingUp, color: "text-blue-500 bg-blue-500/10", text: "Which materials are trending in demand right now?" },
              { icon: BarChart2, color: "text-orange-500 bg-orange-500/10", text: "Compare my prices against market averages" },
              { icon: ShoppingCart, color: "text-violet-500 bg-violet-500/10", text: "Which cities have the highest construction demand?" },
              { icon: Layers, color: "text-amber-500 bg-amber-500/10", text: "Suggest materials I should add to my inventory" },
              { icon: AlertTriangle, color: "text-red-500 bg-red-500/10", text: "Analyze my low stock items and suggest reorder quantities" },
              { icon: TrendingDown, color: "text-slate-500 bg-slate-500/10", text: "What's the seasonal demand pattern for building materials?" },
            ].map(({ icon: Icon, color, text }) => (
              <button
                key={text}
                type="button"
                onClick={() => injectPrompt(text)}
                className="flex w-full items-start gap-3 rounded-xl border border-border/60 bg-background/30 p-3 hover:border-orange-500/20 hover:bg-orange-500/5 transition-all text-left group"
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
