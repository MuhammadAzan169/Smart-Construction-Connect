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
  Sparkles, Target, Image as ImageIcon, History, Trash2, ChevronLeft, ChevronRight, Pencil, MessageSquare,
} from "lucide-react";

import { renderMarkdown } from "@/components/shared/MarkdownRenderer";
import { MatchScoreRing } from "@/components/shared/MatchScoreRing";
import { GlassCard } from "@/components/shared/GlassCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, QuoteRequest, type EnrichedRecommendation, type ChatSessionMeta } from "@/lib/api";
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
  completed: { label: "Completed", color: "text-primary",    bg: "bg-primary/10",     icon: FileCheck },
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
      className="rounded-2xl border border-primary/20 bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow"
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
          {priceRange && <span className="text-xs font-semibold text-primary">{priceRange}</span>}
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
          <Button size="sm" className="flex-1 text-xs h-8 gap-1.5 rounded-xl gradient-bg text-primary-foreground" onClick={() => onContact(rec)}>
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
  const [historyOpen, setHistoryOpen] = useState(true);

  /* ── Chat history state ── */
  const [chatSessions, setChatSessions] = useState<ChatSessionMeta[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const currentSessionIdRef = useRef<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  /* ── Helper to set session ID in both state and ref ── */
  const setSessionId = useCallback((id: string | null) => {
    currentSessionIdRef.current = id;
    setCurrentSessionId(id);
    if (id) {
      localStorage.setItem("scc_client_chat_session", id);
    } else {
      localStorage.removeItem("scc_client_chat_session");
    }
  }, []);

  /* ── Load greeting ── */
  useEffect(() => {
    const savedSessionId = localStorage.getItem("scc_client_chat_session");

    // Load existing requirements
    if (user?.email) {
      api.ai.getRequirements(user.email).then((res) => {
        if (res.requirements && Object.keys(res.requirements).length > 0) {
          setRequirements(res.requirements);
          setReqStatus(res.requirements.status as string || "gathering");
        }
      }).catch(() => {});
    }

    // Load chat history sessions and potentially restore saved session
    if (user?.email) {
      setLoadingHistory(true);
      api.ai.listChatSessions().then((res) => {
        setChatSessions(res.sessions ?? []);
        // If we have a saved session that still exists, restore it
        if (savedSessionId && res.sessions?.some((s: ChatSessionMeta) => s.session_id === savedSessionId)) {
          api.ai.getChatSession(savedSessionId).then((sess) => {
            const loaded: Message[] = sess.messages
              .filter((m: { role: string; content: string }) => m.role === "user" || m.role === "assistant")
              .map((m: { role: string; content: string }, i: number) => ({
                id: i + 1,
                role: m.role === "assistant" ? "ai" as const : "user" as const,
                text: m.content,
              }));
            nextIdRef.current = loaded.length + 1;
            setMessages(loaded);
            setSessionId(savedSessionId);
            // Re-extract requirements to restore recommendation cards
            if (loaded.length > 0) {
              const history = loaded.map((m) => ({ role: m.role === "ai" ? "assistant" : "user", content: m.text }));
              extractRequirements(history);
            }
          }).catch(() => {
            _loadFreshGreeting();
          });
        } else {
          _loadFreshGreeting();
        }
      }).catch(() => {
        _loadFreshGreeting();
      }).finally(() => setLoadingHistory(false));
    } else {
      _loadFreshGreeting();
    }

    function _loadFreshGreeting() {
      api.ai.chat([], user?.email || "", "client").then((r) => {
        setMessages([{ id: getNextId(), role: "ai", text: r.response }]);
      }).catch(() => {
        setMessages([{ id: getNextId(), role: "ai", text: "Hello! 🏗️ I'm your AI Construction Consultant. Tell me about your project — location, budget, and plot size — and I'll find the best builders for you!" }]);
      });
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

  /* ── Auto-save chat to history ── */
  const saveSession = useCallback(async (msgs: Message[], sessId: string | null) => {
    if (!user?.email || msgs.length < 2) return;
    const history = msgs.filter((m) => !m.isStreaming).map((m) => ({ role: m.role === "ai" ? "assistant" : "user", content: m.text }));
    try {
      if (sessId) {
        await api.ai.updateChatSession(sessId, { messages: history });
        // Refresh session list title
        setChatSessions((prev) => prev.map((s) =>
          s.session_id === sessId ? { ...s, message_count: msgs.length, updated_at: new Date().toISOString() } : s
        ));
      } else {
        const res = await api.ai.createChatSession("", history);
        setSessionId(res.session_id);
        setChatSessions((prev) => [{ session_id: res.session_id, title: res.title, created_at: res.created_at, updated_at: res.created_at, message_count: msgs.length }, ...prev]);
      }
    } catch {
      // Non-critical
    }
  }, [user?.email, setSessionId]);

  /* ── Load a past chat session ── */
  const loadSession = useCallback(async (sessionId: string) => {
    try {
      const res = await api.ai.getChatSession(sessionId);
      const loaded: Message[] = res.messages
        .filter((m: { role: string; content: string }) => m.role === "user" || m.role === "assistant")
        .map((m: { role: string; content: string }, i: number) => ({
          id: i + 1,
          role: m.role === "assistant" ? "ai" as const : "user" as const,
          text: m.content,
        }));
      nextIdRef.current = loaded.length + 1;
      setMessages(loaded);
      setSessionId(sessionId);
      setSidebarTab("tracker");
      // Re-extract requirements and recommendations from loaded history
      if (loaded.length > 0) {
        const history = loaded.map((m) => ({ role: m.role === "ai" ? "assistant" : "user", content: m.text }));
        extractRequirements(history);
      }
    } catch {
      // ignore
    }
  }, [setSessionId, extractRequirements]);

  /* ── Start a new chat ── */
  const startNewChat = useCallback(() => {
    nextIdRef.current = 1;
    setMessages([]);
    setSessionId(null);
    setRecommendations([]);
    setRequirements({});
    setMissingFields([]);
    setReqStatus("gathering");
    setSidebarTab("tracker");
    api.ai.chat([], user?.email || "", "client").then((res) => {
      setMessages([{ id: 1, role: "ai", text: res.response }]);
      nextIdRef.current = 2;
    }).catch(() => {
      setMessages([{ id: 1, role: "ai", text: "Hello! 🏗️ I'm your AI Construction Consultant. Tell me about your project — location, budget, and plot size — and I'll find the best builders for you!" }]);
      nextIdRef.current = 2;
    });
  }, [user?.email, setSessionId]);

  /* ── Delete a chat session ── */
  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      await api.ai.deleteChatSession(sessionId);
      setChatSessions((prev) => prev.filter((s) => s.session_id !== sessionId));
      if (currentSessionId === sessionId) {
        startNewChat();
      }
    } catch {
      // ignore
    }
  }, [currentSessionId, startNewChat]);

  const handleRenameSession = useCallback(async (sessionId: string) => {
    const title = editingTitle.trim();
    setEditingSessionId(null);
    setEditingTitle("");
    if (!title) return;
    try {
      await api.ai.updateChatSession(sessionId, { title });
      setChatSessions((prev) => prev.map((s) => s.session_id === sessionId ? { ...s, title } : s));
    } catch { /* ignore */ }
  }, [editingTitle]);

  const handleDeleteSession = useCallback(async (sessionId: string) => {
    setDeletingSessionId(null);
    try {
      await api.ai.deleteChatSession(sessionId);
      setChatSessions((prev) => prev.filter((s) => s.session_id !== sessionId));
      if (currentSessionId === sessionId) startNewChat();
    } catch { /* ignore */ }
  }, [currentSessionId, startNewChat]);

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
        setMessages((prev) => {
          const updated = [...prev, { id: getNextId(), role: "ai" as const, text: result.response }];
          // Save immediately to prevent data loss on navigation
          saveSession(updated, currentSessionIdRef.current);
          return updated;
        });
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
          } else if (chunk.type === "recommendations" && chunk.recommendations) {
            if (chunk.recommendations.length > 0) {
              setRecommendations(chunk.recommendations as EnrichedRecommendation[]);
            }
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
            // Save immediately (not debounced) to prevent data loss on navigation
            saveSession(updated, currentSessionIdRef.current);
            return updated;
          });
          // Extract requirements after AI response
          extractRequirements(history.concat([{ role: "assistant", content: fullText }]));
        }
      }
    } catch {
      setMessages((prev) => [...prev, { id: getNextId(), role: "ai", text: "Connection issue. Please try again." }]);
    } finally {
      setIsTyping(false);
    }
  }, [getNextId, input, isTyping, messages, user?.email, attachedFile, extractRequirements, saveSession]);

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
            initial={{ opacity: 0, width: "2.25rem" }}
            animate={{ opacity: 1, width: "14rem" }}
            exit={{ opacity: 0, width: "2.25rem" }}
            transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="hidden lg:flex flex-col overflow-hidden shrink-0"
            style={{ minWidth: 0 }}
          >
            <GlassCard interactive={false} className="flex flex-col h-full p-0 overflow-hidden card-shadow">
              <div className="flex items-center gap-2 border-b border-border px-3 py-3 shrink-0">
                <MessageSquare className="h-4 w-4 text-primary shrink-0" />
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
                        currentSessionId === s.session_id ? "bg-primary/10 hover:bg-primary/15" : ""
                      }`}
                      onClick={() => {
                        if (editingSessionId !== s.session_id && deletingSessionId !== s.session_id) {
                          loadSession(s.session_id);
                        }
                      }}
                    >
                      {editingSessionId === s.session_id ? (
                        <input autoFocus value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onBlur={() => handleRenameSession(s.session_id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRenameSession(s.session_id);
                            if (e.key === "Escape") { setEditingSessionId(null); setEditingTitle(""); }
                          }}
                          className="w-full rounded border border-primary/40 bg-background px-2 py-0.5 text-xs text-foreground outline-none"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className="text-xs font-medium text-foreground truncate leading-snug pr-10">
                          {s.title || "Untitled chat"}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(s.updated_at).toLocaleDateString("en-PK", { month: "short", day: "numeric" })}
                        {" · "}{s.message_count} msg{s.message_count !== 1 ? "s" : ""}
                      </span>
                      {editingSessionId !== s.session_id && (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5">
                          <button type="button" title="Rename"
                            onClick={(e) => { e.stopPropagation(); setEditingSessionId(s.session_id); setEditingTitle(s.title); }}
                            className="flex h-6 w-6 items-center justify-center rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
                            <Pencil className="h-3 w-3" />
                          </button>
                          {deletingSessionId === s.session_id ? (
                            <button type="button" title="Confirm delete"
                              onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.session_id); }}
                              className="flex h-6 w-6 items-center justify-center rounded bg-red-500/15 text-red-500 hover:bg-red-500/25 transition-colors">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          ) : (
                            <button type="button" title="Delete"
                              onClick={(e) => { e.stopPropagation(); setDeletingSessionId(s.session_id); setTimeout(() => setDeletingSessionId(null), 3000); }}
                              className="flex h-6 w-6 items-center justify-center rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-red-400">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      )}
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

      {/* ═══════════════════════════════════════════════════════
          Center: Chat Panel
      ═══════════════════════════════════════════════════════ */}
      <GlassCard interactive={false} className="flex flex-1 flex-col p-0 overflow-hidden card-shadow">

        {/* Header */}
        <div className="relative flex items-center gap-3 border-b border-border px-5 py-4 overflow-hidden">
          <div className="absolute start-0 top-0 h-full w-40 bg-gradient-to-r from-primary/8 to-transparent pointer-events-none" />
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="relative flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl gradient-bg shadow-md">
            <Bot className="h-5 w-5 text-primary-foreground" />
            <div className="absolute inset-0 rounded-xl ring-2 ring-primary/20" />
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
          className="flex-1 overflow-y-auto scroll-styled px-5 py-5 space-y-3"
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
                  className="rounded-xl border border-border bg-secondary/50 px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/30 hover:bg-secondary hover:text-foreground transition-colors text-start"
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
                  msg.role === "ai" ? "gradient-bg" : "bg-secondary border border-border"
                }`}>
                  {msg.role === "ai" ? <Bot className="h-4 w-4 text-primary-foreground" /> : <User className="h-4 w-4 text-muted-foreground" />}
                </div>
                <div
                  className={`max-w-[85%] md:max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm overflow-hidden break-words ${
                    msg.role === "ai"
                      ? "bg-secondary text-foreground rounded-bl-md"
                      : "gradient-bg text-primary-foreground rounded-br-md"
                  }`}
                  dir="auto"
                >
                  {msg.role === "ai" ? (
                    <>
                      {renderMarkdown(msg.text)}
                      {msg.isStreaming && <span className="inline-block w-1.5 h-4 ms-0.5 bg-primary/60 animate-pulse rounded-sm" />}
                    </>
                  ) : <span className="whitespace-pre-wrap">{msg.text}</span>}
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
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl gradient-bg shadow-sm">
                  <Sparkles className="h-4 w-4 text-primary-foreground" />
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
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl gradient-bg shadow-sm">
                <Bot className="h-4 w-4 text-primary-foreground" />
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
            <div className="mb-2 flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
              <FileText className="h-4 w-4 text-primary shrink-0" />
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
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors"
                      whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }} aria-label="Play recording">
                      <Play className="h-4 w-4" />
                    </motion.button>
                  </>
                )}
                <div className="flex-1 flex items-start rounded-2xl border border-primary/30 bg-primary/5 px-3 py-1 focus-within:border-primary/50 transition-colors min-w-0">
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
                  className="flex h-10 shrink-0 items-center gap-1.5 rounded-2xl gradient-bg px-3 text-xs font-medium text-primary-foreground shadow-sm disabled:opacity-40 transition-opacity"
                  whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }} aria-label="Use transcript">
                  <Check className="h-3.5 w-3.5" /> Use
                </motion.button>
              </>
            )}

            {/* Normal state: text input + attach + mic + send */}
            {!voice.isRecording && !voice.isPreviewing && (
              <>
                <div className="flex-1 flex items-center gap-2 rounded-2xl border border-border bg-secondary/40 px-4 py-1 focus-within:border-primary/40 transition-colors">
                  <textarea
                    id="client-chat-input"
                    rows={1}
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px';
                    }}
                    placeholder="Describe your project — location, budget, plot size..."
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none focus:outline-none min-w-0 py-2 resize-none max-h-32 overflow-y-auto"
                    disabled={isTyping}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); (e.target as HTMLTextAreaElement).style.height = 'auto'; } }}
                  />
                </div>
                <motion.button type="button" onClick={() => fileInputRef.current?.click()} disabled={isTyping}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-secondary/40 text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors disabled:opacity-40"
                  whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }} aria-label="Attach file">
                  <Paperclip className="h-4 w-4" />
                </motion.button>
                {(voice.isSupported || voice.isMediaSupported) && (
                  <motion.button type="button" onClick={() => voice.startRecording("auto")} disabled={isTyping}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-secondary/40 text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors disabled:opacity-40"
                    whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }} aria-label="Start voice input">
                    <Mic className="h-4 w-4" />
                  </motion.button>
                )}
                <motion.button type="submit" disabled={(!input.trim() && !attachedFile) || isTyping}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl gradient-bg text-primary-foreground shadow-sm disabled:opacity-40 transition-opacity"
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
      <div className="hidden lg:flex w-80 shrink-0 flex-col gap-3">

        {/* Tab switcher */}
        <div className="flex rounded-xl border border-border bg-card overflow-hidden">
          <button
            type="button"
            onClick={() => setSidebarTab("tracker")}
            className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium transition-colors ${
              sidebarTab === "tracker" ? "bg-primary/10 text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Target className="h-3 w-3" /> Reqs
          </button>
          <button
            type="button"
            onClick={() => setSidebarTab("hub")}
            className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium transition-colors ${
              sidebarTab === "hub" ? "bg-primary/10 text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Layers className="h-3 w-3" /> Hub
          </button>
        </div>

        {/* ── Requirement Tracker Panel ── */}
        {sidebarTab === "tracker" && (
          <GlassCard interactive={false} className="flex flex-col flex-1 p-0 overflow-hidden card-shadow">
            <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Target className="h-4 w-4 text-primary" />
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
                      reqStatus === "nearly_complete" ? "bg-amber-500" : "bg-primary"
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
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <Layers className="h-4 w-4 text-primary" />
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
                    { label: "Completed", value: stats.completed, color: "text-primary", bg: "bg-primary/8" },
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
                      { label: "Completed", pct: completedPct, color: "bg-primary" },
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
                    <Link to="/requests" className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
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
                  <Button asChild size="sm" className="gradient-bg text-primary-foreground text-xs h-8 gap-1.5">
                    <Link to="/requests"><Plus className="h-3.5 w-3.5" /> New Request</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline" className="text-xs h-8 gap-1.5 border-primary/20 hover:border-primary/40">
                    <Link to="/companies"><Building2 className="h-3.5 w-3.5" /> Browse</Link>
                  </Button>
                </div>
              </div>
            </GlassCard>

            {/* Quick Queries */}
            <GlassCard interactive={false} className="flex flex-col p-0 overflow-hidden card-shadow">
              <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground leading-tight">Quick Queries</h3>
                  <p className="text-[11px] text-muted-foreground leading-tight">Tap to ask instantly</p>
                </div>
              </div>
              <div className="p-3 space-y-1.5 max-h-64 overflow-y-auto scroll-styled">
                {CLIENT_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => injectPrompt(prompt)}
                    className="w-full flex items-center gap-2.5 rounded-xl border border-border bg-secondary/30 px-3 py-2 text-start hover:border-primary/30 hover:bg-primary/5 transition-all group"
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/50 group-hover:bg-primary transition-colors" />
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
