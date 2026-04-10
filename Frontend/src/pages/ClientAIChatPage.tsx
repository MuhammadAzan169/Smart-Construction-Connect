/**
 * ClientAIChatPage — AI Construction Consultant for clients.
 *
 * Features:
 *  • Smart conversational requirement gathering with live tracker
 *  • Intelligent company recommendation cards with full details
 *  • Streaming AI chat with voice + file upload
 *  • Right panel: Requirement Tracker + Project Hub
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Bot, User, Send, Paperclip, FileText, X,
  Home, Clock, CheckCircle2, XCircle, FileCheck,
  Building2, ArrowRight, Plus, Layers, AlertCircle,
  Mic, Square, Play, RotateCcw, Check, Star, MapPin,
  Phone, Shield, Calendar, Eye, MessageCircle, ChevronDown, ChevronUp,
  Sparkles, Target, Image as ImageIcon,
} from "lucide-react";

import { renderMarkdown } from "@/components/shared/MarkdownRenderer";
import { GlassCard } from "@/components/shared/GlassCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, QuoteRequest, type EnrichedRecommendation } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";

/* ── Types ──────────────────────────────────────────────────────── */
interface Message { id: number; role: "user" | "ai"; text: string; isStreaming?: boolean; recommendations?: EnrichedRecommendation[]; }

/* ── Suggested prompts ──────────────────────────────────────────── */
const CLIENT_PROMPTS = [
  "I want to build a 5 marla house in Lahore DHA, budget 80 lacs",
  "What's the current construction cost per sqft in Karachi?",
  "Find me top-rated construction companies in Islamabad",
  "مجھے اسلام آباد میں 10 مرلہ مکان بنوانا ہے",
  "How long does grey structure take for a 10 marla plot?",
  "What are the best construction materials for a low budget project?",
  "Compare construction packages for a 5 marla house",
  "Which areas in Lahore have the most construction activity?",
];

const STATUS_META = {
  pending:   { label: "Pending",   color: "text-amber-500",  bg: "bg-amber-500/10",   icon: Clock },
  accepted:  { label: "Accepted",  color: "text-emerald-500", bg: "bg-emerald-500/10", icon: CheckCircle2 },
  rejected:  { label: "Rejected",  color: "text-red-500",    bg: "bg-red-500/10",     icon: XCircle },
  completed: { label: "Completed", color: "text-sky-500",    bg: "bg-sky-500/10",     icon: FileCheck },
} as const;

const REQUIREMENT_LABELS: Record<string, { label: string; icon: string }> = {
  city: { label: "City", icon: "🏙️" },
  area: { label: "Area", icon: "📍" },
  plot_size: { label: "Plot Size", icon: "📐" },
  project_type: { label: "Project Type", icon: "🏠" },
  budget_min: { label: "Budget", icon: "💰" },
  num_floors: { label: "Floors", icon: "🏢" },
  num_rooms: { label: "Rooms", icon: "🚪" },
  design_style: { label: "Style", icon: "🎨" },
  timeline: { label: "Timeline", icon: "📅" },
  construction_type: { label: "Construction", icon: "🔨" },
  special_requirements: { label: "Special", icon: "⭐" },
};

/* ── Recommendation Card ──────────────────────────────────────── */
function RecommendationCard({ rec, onContact }: { rec: EnrichedRecommendation; onContact: (rec: EnrichedRecommendation) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [galleryIdx, setGalleryIdx] = useState(0);

  const rating = rec.rating ?? (rec.ai_scores as Record<string, number> | undefined)?.overall ?? 0;
  const ratingStars = Math.round(rating * 10) / 10;
  const isVerified = rec.verification_status === "verified";
  const services = rec.services ? Object.keys(rec.services as Record<string, unknown>).slice(0, 4) : [];
  const priceRange = rec.min_price_sqft && rec.max_price_sqft
    ? `PKR ${rec.min_price_sqft.toLocaleString()} - ${rec.max_price_sqft.toLocaleString()}/sqft`
    : null;
  const gallery = rec.gallery_images ?? [];
  const slug = rec.id || "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-sky-500/20 bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow"
    >
      {/* Gallery / Image */}
      {gallery.length > 0 ? (
        <div className="relative h-36 overflow-hidden bg-muted/30">
          <img src={gallery[galleryIdx]} alt={`${rec.name} gallery`} className="h-full w-full object-cover" loading="lazy" />
          {gallery.length > 1 && (
            <div className="absolute bottom-2 right-2 flex gap-1">
              {gallery.map((_, idx) => (
                <button key={idx} type="button" onClick={() => setGalleryIdx(idx)}
                  className={`h-1.5 w-1.5 rounded-full transition-colors ${idx === galleryIdx ? "bg-white" : "bg-white/40"}`} />
              ))}
            </div>
          )}
          {gallery.length > 1 && (
            <button type="button" onClick={() => setGalleryIdx((i) => (i + 1) % gallery.length)}
              className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors">
              <ImageIcon className="h-3 w-3" />
            </button>
          )}
          {isVerified && (
            <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
              <Shield className="h-3 w-3" /> Verified
            </div>
          )}
        </div>
      ) : (rec.dp_url || rec.logo_url) ? (
        <div className="relative h-36 overflow-hidden bg-muted/30">
          <img src={rec.dp_url || rec.logo_url || ""} alt={rec.name} className="h-full w-full object-cover" loading="lazy" />
          {isVerified && (
            <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
              <Shield className="h-3 w-3" /> Verified
            </div>
          )}
        </div>
      ) : null}

      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start gap-3">
          {rec.logo_url && <img src={rec.logo_url} alt="" className="h-10 w-10 rounded-xl object-cover border border-border shrink-0" />}
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold text-foreground leading-tight truncate">{rec.name}</h4>
            <div className="flex items-center gap-2 mt-0.5">
              {rec.city && <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground"><MapPin className="h-3 w-3" /> {rec.city}</span>}
              {rating > 0 && <span className="flex items-center gap-0.5 text-[11px] text-amber-500"><Star className="h-3 w-3 fill-amber-500" /> {ratingStars}</span>}
            </div>
          </div>
          <Badge variant="outline" className="shrink-0 text-[10px] capitalize">{rec.type}</Badge>
        </div>

        {rec.description && <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{rec.description}</p>}

        {services.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {services.map((s) => <Badge key={s} variant="secondary" className="text-[10px] px-1.5 py-0 capitalize">{s.replace(/_/g, " ")}</Badge>)}
          </div>
        )}

        <div className="flex items-center justify-between">
          {priceRange && <span className="text-xs font-semibold text-sky-600 dark:text-sky-400">{priceRange}</span>}
          {rec.year_established && <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground"><Calendar className="h-3 w-3" /> Est. {rec.year_established}</span>}
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden space-y-2">
              {rec.construction_capability && (
                <div className="rounded-xl bg-secondary/50 p-2.5 text-[11px] space-y-1">
                  <p className="font-semibold text-foreground">Construction Capability</p>
                  {Object.entries(rec.construction_capability as Record<string, unknown>).slice(0, 5).map(([k, v]) => (
                    <p key={k} className="text-muted-foreground"><span className="capitalize">{k.replace(/_/g, " ")}:</span> <span className="text-foreground">{String(v)}</span></p>
                  ))}
                </div>
              )}
              {rec.experience && (
                <div className="rounded-xl bg-secondary/50 p-2.5 text-[11px] space-y-1">
                  <p className="font-semibold text-foreground">Experience</p>
                  {Object.entries(rec.experience as Record<string, unknown>).slice(0, 4).map(([k, v]) => (
                    <p key={k} className="text-muted-foreground"><span className="capitalize">{k.replace(/_/g, " ")}:</span> <span className="text-foreground">{Array.isArray(v) ? (v as string[]).join(", ") : String(v)}</span></p>
                  ))}
                </div>
              )}
              {rec.contact && Object.keys(rec.contact).length > 0 && (
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  {Object.entries(rec.contact).slice(0, 2).map(([k, v]) => <span key={k}>{v}</span>)}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-2 pt-1">
          <Button asChild size="sm" variant="outline" className="flex-1 text-xs h-8 gap-1.5 rounded-xl">
            <Link to={`/companies/${encodeURIComponent(slug)}`}><Eye className="h-3.5 w-3.5" /> View Details</Link>
          </Button>
          <Button size="sm" className="flex-1 text-xs h-8 gap-1.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white" onClick={() => onContact(rec)}>
            <MessageCircle className="h-3.5 w-3.5" /> Contact Now
          </Button>
          <button type="button" onClick={() => setExpanded(!expanded)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground hover:text-foreground transition-colors">
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   Main Page
══════════════════════════════════════════════════════════════════ */
export default function ClientAIChatPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

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

  /* ── Requirement tracking state ── */
  const [requirements, setRequirements] = useState<Record<string, unknown>>({});
  const [recommendations, setRecommendations] = useState<EnrichedRecommendation[]>([]);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [reqStatus, setReqStatus] = useState<string>("gathering");

  /* ── Project Hub sidebar state ── */
  const [requests, setRequests] = useState<QuoteRequest[]>([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, accepted: 0, rejected: 0, completed: 0 });
  const [loadingHub, setLoadingHub] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<"tracker" | "hub">("tracker");

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  /* ── Load greeting ── */
  useEffect(() => {
    api.ai.chat([], user?.email || "", "client").then((res) => {
      setMessages([{ id: getNextId(), role: "ai", text: res.response }]);
    }).catch(() => {
      setMessages([{ id: getNextId(), role: "ai", text: "Hello! 🏗️ I'm your AI Construction Consultant. Tell me about your project — location, budget, and plot size — and I'll find the best builders for you!" }]);
    });

    // Load existing requirements
    if (user?.email) {
      api.ai.getRequirements(user.email).then((res) => {
        if (res.requirements && Object.keys(res.requirements).length > 0) {
          setRequirements(res.requirements);
          setReqStatus(res.requirements.status as string || "gathering");
        }
      }).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Load project hub data ── */
  useEffect(() => {
    Promise.all([
      api.requests.list().catch(() => [] as QuoteRequest[]),
      api.requests.stats().catch(() => ({ total: 0, pending: 0, accepted: 0, rejected: 0, completed: 0 })),
    ]).then(([reqs, st]) => {
      setRequests(reqs);
      setStats(st as typeof stats);
    }).finally(() => setLoadingHub(false));
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

  /* ── Extract requirements after AI response ── */
  const extractRequirements = useCallback(async (chatHistory: { role: string; content: string }[]) => {
    if (!user?.email) return;
    try {
      const result = await api.ai.extractRequirements(chatHistory, user.email, "client");
      setRequirements(result.requirements);
      setMissingFields(result.missing_fields);
      setReqStatus(result.requirements.status as string || "gathering");
      if (result.recommendations.length > 0) {
        setRecommendations(result.recommendations);
      }
    } catch {
      // Non-critical — don't interrupt chat
    }
  }, [user?.email]);

  /* ── Send message (streaming) ── */
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
        const result = await api.ai.chatWithFile(currentFile, history, user?.email || "", "client");
        setMessages((prev) => [...prev, { id: getNextId(), role: "ai", text: result.response }]);
        // Extract requirements after file chat
        extractRequirements(history.concat([{ role: "assistant", content: result.response }]));
      } else {
        // Streaming
        const streamMsgId = getNextId();
        setMessages((prev) => [...prev, { id: streamMsgId, role: "ai", text: "", isStreaming: true }]);
        let fullText = "";
        for await (const chunk of api.ai.chatStream(history, user?.email || "", "client")) {
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
          // Extract requirements after AI response
          extractRequirements(history.concat([{ role: "assistant", content: fullText }]));
        }
      }
    } catch {
      setMessages((prev) => [...prev, { id: getNextId(), role: "ai", text: "Connection issue. Please try again." }]);
    } finally {
      setIsTyping(false);
    }
  }, [getNextId, input, isTyping, messages, user?.email, attachedFile, extractRequirements]);

  /* ── Voice handling ── */
  const handleVoiceAccept = useCallback(() => {
    const text = voice.acceptTranscript();
    if (text.trim()) {
      setInput(text);
      handleSend(text);
    }
  }, [voice, handleSend]);

  /* ── Contact from recommendation ── */
  const handleContact = useCallback((rec: EnrichedRecommendation) => {
    navigate(`/messages?start=${encodeURIComponent(rec.name)}`);
  }, [navigate]);

  /* ── Clear requirements ── */
  const handleClearRequirements = useCallback(async () => {
    if (!user?.email) return;
    await api.ai.clearRequirements(user.email).catch(() => {});
    setRequirements({});
    setRecommendations([]);
    setMissingFields([]);
    setReqStatus("gathering");
  }, [user?.email]);

  /* ── Derived stats ── */
  const recentRequests = useMemo(() => requests.slice(0, 4), [requests]);
  const pendingPct = stats.total > 0 ? Math.round((stats.pending / stats.total) * 100) : 0;
  const acceptedPct = stats.total > 0 ? Math.round((stats.accepted / stats.total) * 100) : 0;
  const completedPct = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  const collectedFields = (requirements.collected_fields as string[] | undefined) ?? [];
  const reqProgressPct = Math.min(100, Math.round((collectedFields.length / 6) * 100));

  const injectPrompt = (s: string) => {
    setInput(s);
    const el = document.getElementById("client-chat-input");
    if (el) (el as HTMLInputElement).focus();
  };

  if (!user || user.role !== "client") {
    return (
      <GlassCard interactive={false} className="p-6">
        <p className="text-sm text-muted-foreground">This page is only available to client accounts.</p>
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
          <div className="absolute start-0 top-0 h-full w-40 bg-gradient-to-r from-sky-500/8 to-transparent pointer-events-none" />
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="relative flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500 shadow-md">
            <Home className="h-5 w-5 text-white" />
            <div className="absolute inset-0 rounded-xl ring-2 ring-sky-500/30" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground leading-tight">{t("aiChat.aiConsultant")}</h2>
            <p className="text-[11px] text-muted-foreground leading-tight">{t("aiChat.consultantDesc")}</p>
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
              {CLIENT_PROMPTS.slice(0, 4).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => injectPrompt(s)}
                  className="rounded-xl border border-sky-500/20 bg-sky-500/5 px-3 py-1.5 text-xs text-muted-foreground hover:border-sky-500/40 hover:bg-sky-500/10 hover:text-foreground transition-colors text-start"
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
                  msg.role === "ai" ? "bg-sky-500" : "bg-secondary border border-border"
                }`}>
                  {msg.role === "ai" ? <Home className="h-4 w-4 text-white" /> : <User className="h-4 w-4 text-muted-foreground" />}
                </div>
                <div
                  className={`max-w-[76%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                    msg.role === "ai"
                      ? "bg-secondary text-foreground rounded-bl-md"
                      : "bg-sky-500 text-white rounded-br-md"
                  }`}
                  dir="auto"
                >
                  {msg.role === "ai" ? (
                    <>
                      {renderMarkdown(msg.text)}
                      {msg.isStreaming && <span className="inline-block w-1.5 h-4 ms-0.5 bg-sky-500/60 animate-pulse rounded-sm" />}
                    </>
                  ) : msg.text}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Recommendation Cards inline */}
          {recommendations.length > 0 && !isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3 py-2"
            >
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-500 shadow-sm">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <p className="text-sm font-semibold text-foreground">Top Recommendations for You</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {recommendations.map((rec) => (
                  <RecommendationCard key={rec.id} rec={rec} onContact={handleContact} />
                ))}
              </div>
            </motion.div>
          )}

          {/* Typing indicator */}
          {isTyping && !messages.some(m => m.isStreaming) && (
            <motion.div
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex items-end gap-2.5"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-500 shadow-sm">
                <Home className="h-4 w-4 text-white" />
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
            <div className="mb-2 flex items-center gap-2 rounded-xl border border-sky-500/20 bg-sky-500/5 px-3 py-2">
              <FileText className="h-4 w-4 text-sky-500 shrink-0" />
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
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-secondary/40 text-muted-foreground hover:text-foreground hover:border-sky-500/30 transition-colors disabled:opacity-40"
                  whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }} aria-label="Attach file">
                  <Paperclip className="h-4 w-4" />
                </motion.button>
                {(voice.isSupported || voice.isMediaSupported) && (
                  <motion.button type="button" onClick={() => voice.startRecording("auto")} disabled={isTyping}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-secondary/40 text-muted-foreground hover:text-foreground hover:border-sky-500/30 transition-colors disabled:opacity-40"
                    whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }} aria-label="Start voice input">
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
                    <motion.button type="button" onClick={() => audioPreviewRef.current?.play()}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-sky-500/30 bg-sky-500/5 text-sky-500 hover:bg-sky-500/10 transition-colors"
                      whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }} aria-label="Play recording">
                      <Play className="h-4 w-4" />
                    </motion.button>
                  </>
                )}
                <div className="flex-1 flex items-start rounded-2xl border border-sky-500/30 bg-sky-500/5 px-3 py-1 focus-within:border-sky-500/50 transition-colors min-w-0">
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
                  className="flex h-10 shrink-0 items-center gap-1.5 rounded-2xl bg-sky-500 px-3 text-xs font-medium text-white shadow-sm disabled:opacity-40 transition-opacity"
                  whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }} aria-label="Use transcript">
                  <Check className="h-3.5 w-3.5" /> Use
                </motion.button>
              </>
            )}

            {/* Normal state: text input + send */}
            {!voice.isRecording && !voice.isPreviewing && (
              <>
                <div className="flex-1 flex items-center gap-2 rounded-2xl border border-border bg-secondary/40 px-4 py-1 focus-within:border-sky-500/40 transition-colors">
                  <input
                    id="client-chat-input"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Describe your project — location, budget, plot size..."
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none focus:outline-none min-w-0 py-2"
                    disabled={isTyping}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  />
                </div>
                <motion.button type="submit" disabled={(!input.trim() && !attachedFile) || isTyping}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-500 text-white shadow-sm disabled:opacity-40 transition-opacity"
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
          Right: Sidebar — Requirement Tracker + Project Hub
      ═══════════════════════════════════════════════════════ */}
      <div className="hidden lg:flex w-80 flex-col gap-3">

        {/* Tab switcher */}
        <div className="flex rounded-xl border border-border bg-card overflow-hidden">
          <button
            type="button"
            onClick={() => setSidebarTab("tracker")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
              sidebarTab === "tracker" ? "bg-sky-500/10 text-sky-500 border-b-2 border-sky-500" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Target className="h-3.5 w-3.5" /> Requirements
          </button>
          <button
            type="button"
            onClick={() => setSidebarTab("hub")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
              sidebarTab === "hub" ? "bg-sky-500/10 text-sky-500 border-b-2 border-sky-500" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Layers className="h-3.5 w-3.5" /> Project Hub
          </button>
        </div>

        {/* ── Requirement Tracker Panel ── */}
        {sidebarTab === "tracker" && (
          <GlassCard interactive={false} className="flex flex-col flex-1 p-0 overflow-hidden card-shadow">
            <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10">
                <Target className="h-4 w-4 text-sky-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-foreground leading-tight">Project Requirements</h3>
                <p className="text-[11px] text-muted-foreground leading-tight">
                  {reqStatus === "complete" ? "Ready for recommendations!" :
                   reqStatus === "nearly_complete" ? "Almost there..." : "Tell me about your project"}
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Progress bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{collectedFields.length} of 6+ details gathered</span>
                  <span>{reqProgressPct}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <motion.div
                    className={`h-full rounded-full transition-colors ${
                      reqStatus === "complete" ? "bg-emerald-500" :
                      reqStatus === "nearly_complete" ? "bg-amber-500" : "bg-sky-500"
                    }`}
                    initial={{ width: 0 }}
                    animate={{ width: `${reqProgressPct}%` }}
                    transition={{ duration: 0.6 }}
                  />
                </div>
              </div>

              {/* Collected fields */}
              {collectedFields.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Collected</p>
                  <div className="space-y-1">
                    {collectedFields.map((field) => {
                      const meta = REQUIREMENT_LABELS[field];
                      const value = requirements[field];
                      const displayValue = Array.isArray(value) ? (value as string[]).join(", ")
                        : field === "budget_min" ? `PKR ${Number(value).toLocaleString()}${requirements.budget_max ? ` - ${Number(requirements.budget_max).toLocaleString()}` : "+"}`
                        : String(value ?? "").replace(/_/g, " ");
                      if (!meta || !value) return null;
                      return (
                        <motion.div
                          key={field}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2"
                        >
                          <span className="text-sm">{meta.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-muted-foreground">{meta.label}</p>
                            <p className="text-xs font-medium text-foreground truncate capitalize">{displayValue}</p>
                          </div>
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Missing fields */}
              {missingFields.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Still needed</p>
                  <div className="space-y-1">
                    {missingFields.map((field) => {
                      const meta = REQUIREMENT_LABELS[field];
                      if (!meta) return null;
                      return (
                        <div
                          key={field}
                          className="flex items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2"
                        >
                          <span className="text-sm opacity-40">{meta.icon}</span>
                          <p className="text-xs text-muted-foreground">{meta.label}</p>
                          <AlertCircle className="h-3 w-3 text-amber-500 ms-auto shrink-0" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {collectedFields.length === 0 && missingFields.length === 0 && (
                <div className="rounded-xl border border-dashed border-border py-6 text-center">
                  <Bot className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Start chatting to gather project details</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">Tell the AI your city, budget, plot size…</p>
                </div>
              )}

              {/* Reset button */}
              {collectedFields.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearRequirements}
                  className="w-full text-center text-[11px] text-muted-foreground hover:text-destructive transition-colors py-1"
                >
                  Reset requirements for a new project
                </button>
              )}
            </div>
          </GlassCard>
        )}

        {/* ── Project Hub Panel ── */}
        {sidebarTab === "hub" && (
          <>
            <GlassCard interactive={false} className="flex flex-col p-0 overflow-hidden card-shadow">
              <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10">
                  <Layers className="h-4 w-4 text-sky-500" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-foreground leading-tight">Project Hub</h3>
                  <p className="text-[11px] text-muted-foreground leading-tight">Your quote requests at a glance</p>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Total", value: stats.total, color: "text-foreground", bg: "bg-secondary/60" },
                    { label: "Pending", value: stats.pending, color: "text-amber-500", bg: "bg-amber-500/8" },
                    { label: "Accepted", value: stats.accepted, color: "text-emerald-500", bg: "bg-emerald-500/8" },
                    { label: "Completed", value: stats.completed, color: "text-sky-500", bg: "bg-sky-500/8" },
                  ].map(({ label, value, color, bg }) => (
                    <div key={label} className={`rounded-xl ${bg} px-3 py-2.5 text-center`}>
                      <p className={`text-xl font-bold ${color}`}>{loadingHub ? "…" : value}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Status progress bars */}
                {stats.total > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Request Pipeline</p>
                    {[
                      { label: "Pending", pct: pendingPct, color: "bg-amber-500" },
                      { label: "Accepted", pct: acceptedPct, color: "bg-emerald-500" },
                      { label: "Completed", pct: completedPct, color: "bg-sky-500" },
                    ].map(({ label, pct, color }) => (
                      <div key={label} className="space-y-1">
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>{label}</span><span>{pct}%</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                          <motion.div
                            className={`h-full rounded-full ${color}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.6, delay: 0.1 }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Recent requests */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Recent Requests</p>
                    <Link to="/requests" className="text-[10px] text-sky-500 hover:underline flex items-center gap-0.5">
                      View all <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                  {loadingHub ? (
                    <p className="text-xs text-muted-foreground text-center py-3">Loading…</p>
                  ) : recentRequests.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border py-4 text-center">
                      <AlertCircle className="h-5 w-5 text-muted-foreground/40 mx-auto mb-1" />
                      <p className="text-xs text-muted-foreground">No requests yet</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">Ask the AI to help you find a builder!</p>
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
                              <p className="truncate text-xs font-medium text-foreground">{req.project_title || "—"}</p>
                              <p className="truncate text-[10px] text-muted-foreground">{req.location || "—"}</p>
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
                  <Button asChild size="sm" className="bg-sky-500 hover:bg-sky-600 text-white text-xs h-8 gap-1.5">
                    <Link to="/requests"><Plus className="h-3.5 w-3.5" /> New Request</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline" className="text-xs h-8 gap-1.5 border-sky-500/20 hover:border-sky-500/40">
                    <Link to="/companies"><Building2 className="h-3.5 w-3.5" /> Browse</Link>
                  </Button>
                </div>
              </div>
            </GlassCard>

            {/* Quick Queries */}
            <GlassCard interactive={false} className="flex flex-col p-0 overflow-hidden card-shadow">
              <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10">
                  <Bot className="h-4 w-4 text-sky-500" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground leading-tight">Quick Queries</h3>
                  <p className="text-[11px] text-muted-foreground leading-tight">Tap to ask instantly</p>
                </div>
              </div>
              <div className="p-3 space-y-1.5">
                {CLIENT_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => injectPrompt(prompt)}
                    className="w-full flex items-center gap-2.5 rounded-xl border border-border bg-secondary/30 px-3 py-2 text-start hover:border-sky-500/30 hover:bg-sky-500/5 transition-all group"
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500/50 group-hover:bg-sky-500 transition-colors" />
                    <span className="text-[11px] text-muted-foreground group-hover:text-foreground transition-colors leading-snug line-clamp-2">{prompt}</span>
                  </button>
                ))}
              </div>
            </GlassCard>
          </>
        )}
      </div>
    </motion.div>
  );
}
