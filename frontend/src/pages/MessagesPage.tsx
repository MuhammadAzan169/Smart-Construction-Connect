import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, type Conversation, type Message } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import {
  ArrowLeft, Check, CheckCheck, MessageSquare, Search, Send, Shield, Trash2, X,
  Paperclip, FileText, Mic, Image as ImageIcon, Volume2, Download, Play, Pause,
  Square, RotateCcw, FileSpreadsheet, Archive, AlertCircle,
  File as FileIcon, Film, ChevronRight, Headphones,
} from "lucide-react";

// ── helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getInitials(name: string): string {
  return name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";
}

const AVATAR_COLORS = [
  "from-amber-500 to-orange-500",
  "from-violet-500 to-purple-600",
  "from-cyan-500 to-blue-600",
  "from-emerald-500 to-teal-600",
  "from-rose-500 to-pink-600",
  "from-indigo-500 to-blue-500",
];

function avatarColor(str: string): string {
  let h = 0;
  for (const c of str) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function ChatAvatar({ name, size = "md", isAdmin = false }: { name: string; size?: "sm" | "md" | "lg"; isAdmin?: boolean }) {
  const initials = getInitials(name);
  const cls = size === "sm" ? "h-8 w-8 text-xs" : size === "lg" ? "h-12 w-12 text-base" : "h-10 w-10 text-sm";
  return (
    <div className={cn("shrink-0 rounded-full flex items-center justify-center font-bold text-white shadow-sm relative", cls,
      isAdmin ? "bg-gradient-to-br from-primary to-orange-600" : `bg-gradient-to-br ${avatarColor(name)}`)}>
      {isAdmin ? <Shield className={size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5"} /> : initials}
    </div>
  );
}

function classifyAttachment(att: Message["attachment"]): "image" | "video" | "audio" | "voice" | "pdf" | "word" | "excel" | "archive" | "file" {
  if (!att) return "file";
  const ct = att.content_type?.toLowerCase() ?? "";
  const fn = att.filename?.toLowerCase() ?? "";
  const tp = att.type?.toLowerCase() ?? "";
  if (ct.startsWith("image/") || tp === "image") return "image";
  if (ct.startsWith("video/") || tp === "video") return "video";
  if (tp === "voice") return "voice";
  if (ct.startsWith("audio/")) return "audio";
  if (ct === "application/pdf" || fn.endsWith(".pdf")) return "pdf";
  if (fn.endsWith(".doc") || fn.endsWith(".docx") || ct.includes("msword") || ct.includes("wordprocessingml")) return "word";
  if (fn.endsWith(".xls") || fn.endsWith(".xlsx") || ct.includes("spreadsheet") || ct.includes("ms-excel")) return "excel";
  if (fn.endsWith(".zip") || fn.endsWith(".rar") || fn.endsWith(".7z") || fn.endsWith(".tar") || fn.endsWith(".gz")) return "archive";
  return "file";
}

function FileTypeBadge({ kind }: { kind: ReturnType<typeof classifyAttachment> }) {
  const labels: Record<string, string> = { pdf: "PDF", word: "DOCX", excel: "XLSX", archive: "ZIP", video: "VIDEO", audio: "AUDIO", voice: "VOICE", image: "IMAGE", file: "FILE" };
  const colors: Record<string, string> = {
    pdf: "bg-red-500/15 text-red-400", word: "bg-blue-500/15 text-blue-400",
    excel: "bg-emerald-500/15 text-emerald-400", archive: "bg-yellow-500/15 text-yellow-400",
    video: "bg-purple-500/15 text-purple-400", audio: "bg-pink-500/15 text-pink-400",
    voice: "bg-pink-500/15 text-pink-400", image: "bg-cyan-500/15 text-cyan-400",
    file: "bg-muted text-muted-foreground",
  };
  return (
    <span className={cn("rounded px-1 py-0.5 text-[9px] font-bold tracking-wide uppercase", colors[kind] ?? colors.file)}>
      {labels[kind] ?? "FILE"}
    </span>
  );
}

// ── Custom Audio Player ───────────────────────────────────────────────────────

function AudioPlayer({ url, label, isMine, downloadName }: { url: string; label: string; isMine: boolean; downloadName: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const fmtTime = (s: number) => {
    if (!isFinite(s) || isNaN(s)) return "0:00";
    const m = Math.floor(s / 60);
    return `${m}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
  };

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play().then(() => setPlaying(true)).catch(() => {}); }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current;
    if (!a || !a.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    a.currentTime = a.duration * pct;
    setProgress(pct * 100);
    setCurrentTime(a.currentTime);
  };

  const trackBg = isMine ? "rgba(255,255,255,0.15)" : "rgba(148,163,184,0.2)";
  const fillBg = isMine ? "rgba(255,255,255,0.85)" : "rgb(var(--primary))";

  return (
    <div className={cn("mt-2 flex items-center gap-2.5 rounded-2xl px-3 py-2.5 min-w-[216px] max-w-full",
      isMine ? "bg-black/20" : "bg-secondary/70 border border-border/40")}>
      <audio
        ref={audioRef} src={url} preload="metadata"
        onLoadedMetadata={(e) => setDuration((e.target as HTMLAudioElement).duration)}
        onTimeUpdate={(e) => {
          const a = e.target as HTMLAudioElement;
          setCurrentTime(a.currentTime);
          setProgress(a.duration ? (a.currentTime / a.duration) * 100 : 0);
        }}
        onEnded={() => { setPlaying(false); setProgress(0); setCurrentTime(0); }}
      />

      {/* Play / Pause */}
      <button
        onClick={toggle}
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors",
          isMine ? "bg-white/20 hover:bg-white/30 text-white" : "bg-primary/15 hover:bg-primary/25 text-primary",
        )}>
        {playing
          ? <Pause className="h-3.5 w-3.5 fill-current" />
          : <Play className="h-3.5 w-3.5 fill-current translate-x-px" />}
      </button>

      {/* Track + meta */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <p className={cn("text-[11px] font-semibold leading-none truncate", isMine ? "text-white/65" : "text-muted-foreground")}>
          {label}
        </p>

        {/* Progress bar */}
        <div
          className="relative h-1 rounded-full cursor-pointer"
          style={{ background: trackBg }}
          onClick={seek}>
          <div
            className="absolute inset-y-0 start-0 rounded-full transition-[width] duration-100"
            style={{ width: `${progress}%`, background: fillBg }}
          />
          {/* Thumb dot */}
          <div
            className="absolute top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full shadow-sm border border-black/10"
            style={{ left: `calc(${progress}% - 5px)`, background: fillBg }}
          />
        </div>

        {/* Time */}
        <div className="flex justify-between">
          <span className={cn("text-[10px] tabular-nums", isMine ? "text-white/50" : "text-muted-foreground/60")}>
            {playing || currentTime > 0 ? fmtTime(currentTime) : fmtTime(duration)}
          </span>
          <span className={cn("text-[10px] tabular-nums", isMine ? "text-white/35" : "text-muted-foreground/40")}>
            {fmtTime(duration)}
          </span>
        </div>
      </div>

      {/* Download */}
      <a href={url} download={downloadName}
        className={cn("shrink-0 flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
          isMine ? "text-white/40 hover:text-white/80 hover:bg-white/10" : "text-muted-foreground/40 hover:text-foreground hover:bg-secondary")}
        title="Download" onClick={(e) => e.stopPropagation()}>
        <Download className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}

// ── Attachment Bubble ─────────────────────────────────────────────────────────

interface AttachmentBubbleProps {
  attachment: NonNullable<Message["attachment"]>;
  isMine: boolean;
  onLightbox: (url: string) => void;
}

function AttachmentBubble({ attachment, isMine, onLightbox }: AttachmentBubbleProps) {
  const kind = classifyAttachment(attachment);
  const [videoErr, setVideoErr] = useState(false);

  if (kind === "image") {
    return (
      <div className="relative mt-2 group/img rounded-xl overflow-hidden border border-white/10 shadow-sm max-w-[280px]">
        <img
          src={attachment.url} alt={attachment.filename}
          className="w-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
          loading="lazy"
          onClick={() => onLightbox(attachment.url)}
          onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity pointer-events-none" />
        <div className="absolute bottom-2 right-2 flex gap-1.5 opacity-0 group-hover/img:opacity-100 transition-opacity">
          <button onClick={() => onLightbox(attachment.url)}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/50 text-white hover:bg-black/70 transition-colors" title="View">
            <Play className="h-3 w-3" />
          </button>
          <a href={attachment.url} download={attachment.filename}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/50 text-white hover:bg-black/70 transition-colors" title="Download"
            onClick={(e) => e.stopPropagation()}>
            <Download className="h-3 w-3" />
          </a>
        </div>
      </div>
    );
  }

  if (kind === "video" && !videoErr) {
    return (
      <div className="relative mt-2 rounded-xl overflow-hidden border border-white/10 shadow-sm">
        <video src={attachment.url} controls className="max-w-[280px] w-full rounded-xl" preload="metadata" onError={() => setVideoErr(true)} />
        <a href={attachment.url} download={attachment.filename}
          className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-lg bg-black/50 text-white opacity-0 hover:opacity-100 transition-opacity hover:bg-black/70" title="Download"
          onClick={(e) => e.stopPropagation()}>
          <Download className="h-3 w-3" />
        </a>
      </div>
    );
  }

  if (kind === "voice" || kind === "audio") {
    return (
      <AudioPlayer
        url={attachment.url}
        label={kind === "voice" ? "Voice message" : (attachment.filename || "Audio file")}
        isMine={isMine}
        downloadName={attachment.filename || "audio"}
      />
    );
  }

  if (kind === "pdf") {
    return (
      <div className="mt-2 rounded-xl border border-border/40 overflow-hidden shadow-sm">
        <div className={cn("flex items-center gap-2 px-3 py-2", isMine ? "bg-black/15" : "bg-secondary/50")}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/20">
            <FileText className="h-4 w-4 text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate">{attachment.filename}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <FileTypeBadge kind="pdf" />
              <span className={cn("text-[10px]", isMine ? "text-white/50" : "text-muted-foreground")}>{formatFileSize(attachment.size)}</span>
            </div>
          </div>
          <a href={attachment.url} download={attachment.filename}
            className={cn("shrink-0 flex h-7 w-7 items-center justify-center rounded-lg hover:bg-white/10 transition-colors", isMine ? "text-white/60" : "text-muted-foreground")} title="Download">
            <Download className="h-3.5 w-3.5" />
          </a>
        </div>
        <iframe src={`${attachment.url}#view=FitH&toolbar=0`} title={attachment.filename}
          className={cn("w-full h-48 border-0 border-t", isMine ? "border-white/10" : "border-border/40")} loading="lazy" />
      </div>
    );
  }

  // Word / Excel / Archive / Generic
  const colorMap: Record<string, string> = {
    word: "bg-blue-500/20 text-blue-400", excel: "bg-emerald-500/20 text-emerald-400",
    archive: "bg-yellow-500/20 text-yellow-400", file: "bg-muted/50 text-muted-foreground",
  };
  const iconMap: Record<string, React.ReactNode> = {
    word: <FileText className="h-4 w-4" />, excel: <FileSpreadsheet className="h-4 w-4" />,
    archive: <Archive className="h-4 w-4" />, file: <FileIcon className="h-4 w-4" />,
  };

  return (
    <a href={attachment.url} download={attachment.filename}
      className={cn("mt-2 flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-colors",
        isMine ? "bg-black/15 hover:bg-black/25" : "bg-secondary/50 border border-border/40 hover:bg-secondary/80")}>
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", colorMap[kind] ?? colorMap.file)}>
        {iconMap[kind] ?? <FileIcon className="h-4 w-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate">{attachment.filename}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <FileTypeBadge kind={kind} />
          <span className={cn("text-[10px]", isMine ? "text-white/50" : "text-muted-foreground")}>{formatFileSize(attachment.size)}</span>
        </div>
      </div>
      <Download className={cn("h-4 w-4 shrink-0", isMine ? "text-white/50" : "text-muted-foreground")} />
    </a>
  );
}

// ── System/Notification Message ───────────────────────────────────────────────

function SystemMessage({ msg }: { msg: Message }) {
  const isApproved = msg.verification_status === "approved";
  const isRejected = msg.verification_status === "rejected";
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mx-auto my-3 max-w-lg">
      <div className={cn("rounded-2xl border p-4 shadow-sm",
        isApproved ? "border-emerald-500/30 bg-emerald-500/5" : isRejected ? "border-red-500/30 bg-red-500/5" : "border-primary/20 bg-primary/5")}>
        <div className="flex items-start gap-2.5">
          <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full mt-0.5",
            isApproved ? "bg-emerald-500/20" : isRejected ? "bg-red-500/20" : "bg-primary/20")}>
            {isApproved ? <Check className="h-3.5 w-3.5 text-emerald-400" />
              : isRejected ? <AlertCircle className="h-3.5 w-3.5 text-red-400" />
              : <Shield className="h-3.5 w-3.5 text-primary" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className={cn("text-xs font-bold mb-1", isApproved ? "text-emerald-400" : isRejected ? "text-red-400" : "text-primary")}>
              Platform Notification
            </p>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
            <p className="mt-2 text-[10px] text-muted-foreground">{formatTime(msg.timestamp)}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function MessagesPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvo, setActiveConvo] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeConvoData, setActiveConvoData] = useState<Conversation | null>(null);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<
    | { type: "conversation"; id: string }
    | { type: "message"; convoId: string; msgId: string }
    | null
  >(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [adminContact, setAdminContact] = useState<{ email: string; name: string } | null>(null);
  const [startingAdminChat, setStartingAdminChat] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioPreviewRef = useRef<HTMLAudioElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const [wsConnected, setWsConnected] = useState(false);
  const voice = useVoiceRecorder();

  const email = user?.email ?? "";
  const token = typeof window !== "undefined" ? localStorage.getItem("scc_token") : null;

  const isAdminEmail = (e: string) => e.toLowerCase().includes("admin@");

  const loadConversations = useCallback(async () => {
    try {
      const data = await api.messages.getConversations();
      setConversations(data);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    loadConversations();
    api.messages.getAdminContact().then(setAdminContact).catch(() => {});
  }, [loadConversations]);

  // WebSocket
  useEffect(() => {
    if (!email || !token) return;
    let alive = true;
    function connect() {
      if (!alive) return;
      // In production the frontend (Vercel) and backend (Render) are separate
      // origins, and Vercel's rewrites do NOT proxy WebSockets — so connect the
      // socket straight to the backend when VITE_API_URL is set. Locally it's
      // unset and we use the same origin (Vite dev-server proxies ws).
      const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
      const path = `/api/messages/ws/${encodeURIComponent(email)}?token=${encodeURIComponent(token!)}`;
      const wsUrl = apiUrl
        ? `${apiUrl.replace(/^http/, "ws").replace(/\/$/, "")}${path}`
        : `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}${path}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onopen = () => setWsConnected(true);
      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          if (data.type === "new_message") {
            loadConversations();
            if (data.conversation_id) {
              setActiveConvo((curr) => {
                if (curr === data.conversation_id) {
                  api.messages.getMessages(data.conversation_id).then((res) => {
                    setMessages(res.messages); setActiveConvoData(res.conversation);
                  }).catch(() => {});
                  setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
                }
                return curr;
              });
            }
          } else if (data.type === "messages_read" && data.conversation_id) {
            setActiveConvo((curr) => {
              if (curr === data.conversation_id)
                setMessages((prev) => prev.map((m) => m.sender === email ? { ...m, status: "read" as const, read: true } : m));
              return curr;
            });
            loadConversations();
          }
        } catch { /* ignore */ }
      };
      ws.onclose = () => { wsRef.current = null; setWsConnected(false); if (alive) reconnectTimer.current = setTimeout(connect, 3000); };
      ws.onerror = () => ws.close();
    }
    connect();
    return () => { alive = false; clearTimeout(reconnectTimer.current); wsRef.current?.close(); wsRef.current = null; };
  }, [email, token, loadConversations]);

  // Fallback polling
  useEffect(() => {
    const iv = setInterval(() => {
      loadConversations();
      if (activeConvo) api.messages.getMessages(activeConvo).then((r) => { setMessages(r.messages); setActiveConvoData(r.conversation); }).catch(() => {});
    }, 30_000);
    return () => clearInterval(iv);
  }, [activeConvo, loadConversations]);

  const openConversation = async (id: string) => {
    setActiveConvo(id);
    try {
      const res = await api.messages.getMessages(id);
      setMessages(res.messages); setActiveConvoData(res.conversation); loadConversations();
    } catch { /* ignore */ }
    setTimeout(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); inputRef.current?.focus(); }, 100);
  };

  const contactAdmin = async () => {
    if (!adminContact || startingAdminChat) return;
    setStartingAdminChat(true);
    try {
      const existing = conversations.find((c) => c.participants.includes(adminContact.email));
      if (existing) { await openConversation(existing.id); setStartingAdminChat(false); return; }
      const res = await api.messages.startConversation(adminContact.email, adminContact.name, "Hello! I would like to get in touch with the platform admin.");
      await loadConversations();
      await openConversation(res.conversation_id);
    } catch { /* ignore */ }
    setStartingAdminChat(false);
  };

  const sendMessage = async () => {
    if ((!input.trim() && !attachedFile) || !activeConvo || sending) return;
    setSending(true);
    try {
      let attachment: { url: string; filename: string; size: number; type: string; content_type: string } | undefined;
      if (attachedFile) {
        const ft = attachedFile.type.startsWith("image/") ? "image" : attachedFile.type.startsWith("video/") ? "video" : attachedFile.type.startsWith("audio/") ? "voice" : "file";
        const up = await api.upload.messageFile(attachedFile, email, activeConvo, ft as "file" | "voice" | "image" | "video");
        attachment = { url: up.url, filename: up.filename, size: up.size, type: up.file_type || ft, content_type: up.content_type };
      }
      const content = input.trim() || (attachedFile ? `📎 ${attachedFile.name}` : "");
      const msg = await api.messages.sendMessage(activeConvo, content, attachment);
      setMessages((prev) => [...prev, msg]);
      setInput(""); setAttachedFile(null);
      if (inputRef.current) inputRef.current.style.height = "auto";
      loadConversations();
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch { /* ignore */ } finally { setSending(false); }
  };

  const handleVoiceAccept = useCallback(() => { const t = voice.acceptTranscript(); if (t.trim()) setInput(t); }, [voice]);

  const sendVoiceNote = useCallback(async () => {
    if (!voice.audioBlob || !activeConvo || sending) return;
    const blob = voice.audioBlob; voice.cancelRecording(); setSending(true);
    try {
      const af = new File([blob], `voice-${Date.now()}.webm`, { type: "audio/webm" });
      const up = await api.upload.messageFile(af, email, activeConvo, "voice");
      const att = { url: up.url, filename: up.filename, size: up.size, type: "voice", content_type: up.content_type };
      const msg = await api.messages.sendMessage(activeConvo, "🎤 Voice message", att);
      setMessages((prev) => [...prev, msg]); loadConversations();
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch { /* ignore */ } finally { setSending(false); }
  }, [voice, activeConvo, sending, email, loadConversations]);

  const handleDeleteConversation = async (id: string) => {
    try {
      await api.messages.deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConvo === id) { setActiveConvo(null); setMessages([]); setActiveConvoData(null); }
    } catch { /* ignore */ }
    setDeleteTarget(null);
  };

  const handleDeleteMessage = async (convoId: string, msgId: string) => {
    try { await api.messages.deleteMessage(convoId, msgId); setMessages((prev) => prev.filter((m) => m.id !== msgId)); } catch { /* ignore */ }
    setDeleteTarget(null);
  };

  const getOtherName = (c: Conversation) => { const i = c.participants.indexOf(email); const o = i === 0 ? 1 : 0; return c.participant_names[o] ?? c.participants[o] ?? "Unknown"; };
  const getOtherEmail = (c: Conversation) => c.participants.find((p) => p !== email) ?? "";

  const filteredConvos = search.trim() ? conversations.filter((c) => getOtherName(c).toLowerCase().includes(search.toLowerCase())) : conversations;
  const totalUnread = conversations.reduce((s, c) => s + (c.unread[email] ?? 0), 0);

  const renderStatusIcon = (msg: Message, isMine: boolean) => {
    if (!isMine) return null;
    const st = msg.status ?? (msg.read ? "read" : "sent");
    if (st === "read") return <CheckCheck className="h-3 w-3 text-white/80" />;
    if (st === "delivered") return <CheckCheck className="h-3 w-3 text-white/40" />;
    return <Check className="h-3 w-3 text-white/40" />;
  };

  if (!user) return null;

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">

      {/* Delete modal */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setDeleteTarget(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.93, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.93, y: 12 }} transition={{ duration: 0.16 }}
              className="mx-4 w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10">
                  <Trash2 className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Delete {deleteTarget.type === "conversation" ? "Conversation" : "Message"}</h3>
                  <p className="text-xs text-muted-foreground">Removed from your view only.</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-5">
                {deleteTarget.type === "conversation" ? "Hide this conversation from your inbox?" : "Remove this message from your view?"}
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)} className="rounded-xl">Cancel</Button>
                <Button variant="destructive" size="sm" className="rounded-xl" onClick={() => {
                  if (deleteTarget.type === "conversation") handleDeleteConversation(deleteTarget.id);
                  else handleDeleteMessage(deleteTarget.convoId, deleteTarget.msgId);
                }}>Delete</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxUrl && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/92 backdrop-blur-sm"
            onClick={() => setLightboxUrl(null)}>
            <motion.img src={lightboxUrl} initial={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.88 }} transition={{ duration: 0.22 }}
              className="max-h-[90vh] max-w-[92vw] rounded-2xl object-contain shadow-2xl ring-1 ring-white/10"
              onClick={(e) => e.stopPropagation()} alt="Preview" />
            <div className="absolute top-4 right-4 flex gap-2">
              <a href={lightboxUrl} download className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors" title="Download" onClick={(e) => e.stopPropagation()}>
                <Download className="h-4 w-4" />
              </a>
              <button onClick={() => setLightboxUrl(null)} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════ SIDEBAR ══════════════ */}
      <div className={cn("flex w-full flex-col border-e border-border md:w-80 lg:w-96 bg-card/60", activeConvo && "hidden md:flex")}>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-card/80">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-bg shadow-sm">
            <MessageSquare className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold text-foreground">{t("messagesPage.title", "Messages")}</h2>
            <p className="text-[11px] text-muted-foreground">{conversations.length} conversation{conversations.length !== 1 ? "s" : ""}</p>
          </div>
          {totalUnread > 0 && (
            <Badge className="rounded-full px-2 py-0.5 text-[11px] font-bold bg-primary text-primary-foreground shadow-sm">
              {totalUnread > 99 ? "99+" : totalUnread}
            </Badge>
          )}
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-border/60">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search conversations…"
              className="w-full rounded-xl border border-transparent bg-secondary/60 ps-9 pe-9 h-9 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-border/60 focus:bg-secondary/80 transition-all" />
            {search && (
              <button onClick={() => setSearch("")} className="absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Contact Admin Button */}
        {adminContact && user.role !== "admin" && (
          <div className="px-4 py-2.5 border-b border-border/40">
            <motion.button whileHover={{ x: 2 }} whileTap={{ scale: 0.98 }}
              onClick={contactAdmin} disabled={startingAdminChat}
              className="w-full flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 px-3 py-2.5 transition-colors group disabled:opacity-60">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-orange-600 shadow-sm">
                <Shield className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 text-start">
                <p className="text-sm font-semibold text-foreground leading-tight">Contact Admin</p>
                <p className="text-[11px] text-muted-foreground leading-tight">Platform support &amp; document queries</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </motion.button>
          </div>
        )}

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto scroll-styled">
          {loading ? (
            <div className="space-y-1 p-3">
              {[1,2,3,4,5].map((i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl p-3">
                  <div className="h-10 w-10 rounded-full animate-pulse bg-muted/50 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-2/3 rounded animate-pulse bg-muted/50" />
                    <div className="h-2.5 w-4/5 rounded animate-pulse bg-muted/30" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredConvos.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 p-10 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/30">
                <MessageSquare className="h-7 w-7 text-muted-foreground/40" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{search ? "No results" : "No conversations yet"}</p>
                <p className="mt-1 text-xs text-muted-foreground max-w-[200px] leading-relaxed">
                  {search ? "Try a different search term." : "Start a conversation from any company or supplier profile page."}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-2 space-y-0.5">
              {filteredConvos.map((convo) => {
                const unread = convo.unread[email] ?? 0;
                const isActive = activeConvo === convo.id;
                const otherName = getOtherName(convo);
                const otherEmail = getOtherEmail(convo);
                const isAdmin = isAdminEmail(otherEmail);
                return (
                  <motion.div key={convo.id} whileHover={{ x: 2 }} transition={{ duration: 0.15 }}
                    className={cn("group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 cursor-pointer transition-all",
                      isActive ? "bg-primary/10 border border-primary/20 shadow-sm" : "hover:bg-secondary/50")}
                    onClick={() => openConversation(convo.id)}>
                    <div className="relative shrink-0">
                      <ChatAvatar name={isAdmin ? "Admin" : otherName} isAdmin={isAdmin} size="md" />
                      {unread > 0 && !isActive && <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-primary border-2 border-card" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className={cn("flex-1 truncate text-sm leading-tight", unread > 0 ? "font-bold text-foreground" : "font-medium text-foreground")}>{otherName}</p>
                        {isAdmin && <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 font-bold shrink-0">ADMIN</Badge>}
                        {convo.last_message && <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">{timeAgo(convo.last_message.timestamp)}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <p className={cn("flex-1 truncate text-xs leading-tight", unread > 0 ? "text-foreground/80 font-medium" : "text-muted-foreground")}>
                          {convo.last_message ? `${convo.last_message.sender === email ? "You: " : ""}${convo.last_message.content}` : "No messages yet"}
                        </p>
                        {unread > 0 && (
                          <span className="flex shrink-0 items-center justify-center rounded-full bg-primary min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-primary-foreground leading-none">
                            {unread > 99 ? "99+" : unread}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget({ type: "conversation", id: convo.id }); }}
                      className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-destructive/10">
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-4 py-2 border-t border-border/40">
          <p className="text-center text-[10px] text-muted-foreground/40">Messages are private · Admin has platform oversight</p>
        </div>
      </div>

      {/* ══════════════ CHAT AREA ══════════════ */}
      <div className={cn("flex flex-1 flex-col min-w-0 bg-card/40", !activeConvo && "hidden md:flex")}>
        {activeConvo && activeConvoData ? (
          <>
            {/* Chat header */}
            <div className="flex items-center gap-3 border-b border-border/60 px-5 py-3 bg-card/80 backdrop-blur-sm">
              <Button variant="ghost" size="icon" className="md:hidden h-8 w-8 rounded-lg shrink-0" onClick={() => setActiveConvo(null)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              {(() => {
                const on = getOtherName(activeConvoData);
                const oe = getOtherEmail(activeConvoData);
                const ia = isAdminEmail(oe);
                return (
                  <>
                    <div className="relative shrink-0">
                      <ChatAvatar name={ia ? "Admin" : on} isAdmin={ia} size="md" />
                      <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-card" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold truncate">{on}</p>
                        {ia && <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 font-bold shrink-0">ADMIN</Badge>}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <p className="text-[11px] text-muted-foreground truncate leading-none">{oe}</p>
                        {!wsConnected && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/15 px-1.5 py-0.5 text-[9px] font-medium text-yellow-500">
                            <span className="h-1.5 w-1.5 rounded-full bg-yellow-500 animate-pulse" />Reconnecting
                          </span>
                        )}
                      </div>
                    </div>
                  </>
                );
              })()}
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg hover:bg-destructive/10 shrink-0"
                onClick={() => setDeleteTarget({ type: "conversation", id: activeConvo })} title="Delete conversation">
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto scroll-styled px-4 py-5">
              {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                    <MessageSquare className="h-8 w-8 text-primary/50" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Start the conversation</p>
                    <p className="mt-1 text-xs text-muted-foreground">Send the first message below.</p>
                  </div>
                </div>
              ) : (
                <>
                  <AnimatePresence initial={false}>
                    {messages.map((msg, idx) => {
                      if (msg.is_system) return <SystemMessage key={msg.id} msg={msg} />;

                      const isMine = msg.sender === email;
                      const showDate = idx === 0 || new Date(msg.timestamp).toDateString() !== new Date(messages[idx - 1].timestamp).toDateString();
                      const prevSame = idx > 0 && messages[idx - 1].sender === msg.sender && !messages[idx - 1].is_system;
                      const nextSame = idx < messages.length - 1 && messages[idx + 1].sender === msg.sender && !messages[idx + 1].is_system;
                      const isAdminMsg = isAdminEmail(msg.sender);

                      return (
                        <div key={msg.id}>
                          {showDate && (
                            <div className="flex justify-center py-5">
                              <span className="rounded-full border border-border/50 bg-card/60 px-4 py-1 text-[10px] font-semibold text-muted-foreground backdrop-blur-sm shadow-sm">
                                {formatDate(msg.timestamp)}
                              </span>
                            </div>
                          )}
                          <motion.div
                            initial={{ opacity: 0, y: 8, scale: 0.97 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ duration: 0.2 }}
                            className={cn("group/msg flex w-full items-end gap-2", isMine ? "justify-end" : "justify-start", prevSame ? "mt-0.5" : "mt-3")}
                          >
                            {!isMine && !nextSame && <ChatAvatar name={isAdminMsg ? "Admin" : getOtherName(activeConvoData)} isAdmin={isAdminMsg} size="sm" />}
                            {!isMine && nextSame && <div className="w-8 shrink-0" />}

                            <div className={cn("relative group max-w-[75%] md:max-w-[65%]", isMine && "ml-auto")}>
                              <div className={cn(
                                "w-full px-4 py-2.5 text-sm shadow-sm",
                                isMine ? "gradient-bg text-primary-foreground rounded-2xl rounded-br-sm" : "bg-secondary text-foreground rounded-2xl rounded-bl-sm border border-border/30",
                              )}>
                                {!isMine && !prevSame && (
                                  <p className={cn("mb-1.5 text-[10px] font-bold opacity-70 flex items-center gap-1", isAdminMsg && "text-primary opacity-100")}>
                                    {isAdminMsg && <Shield className="h-3 w-3" />}
                                    {msg.sender_name}
                                  </p>
                                )}

                                {msg.content && !(msg.attachment && (msg.content === `📎 ${msg.attachment.filename}` || msg.content === "🎤 Voice message")) && (
                                  <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                                )}

                                {msg.attachment && <AttachmentBubble attachment={msg.attachment} isMine={isMine} onLightbox={setLightboxUrl} />}

                                <div className={cn("flex items-center gap-1 mt-1.5", isMine ? "justify-end" : "justify-start")}>
                                  <span className={cn("text-[10px] tabular-nums leading-none", isMine ? "text-white/55" : "text-muted-foreground")}>
                                    {formatTime(msg.timestamp)}
                                  </span>
                                  {renderStatusIcon(msg, isMine)}
                                </div>
                              </div>

                              <button
                                onClick={() => setDeleteTarget({ type: "message", convoId: activeConvo, msgId: msg.id })}
                                className={cn("absolute top-1 opacity-0 group-hover/msg:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-destructive/10", isMine ? "-start-8" : "-end-8")}
                                title="Delete message">
                                <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                              </button>
                            </div>
                          </motion.div>
                        </div>
                      );
                    })}
                  </AnimatePresence>
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input Bar */}
            <div className="border-t border-border/60 px-4 py-3 bg-card/80 backdrop-blur-sm">

              {/* Voice recording */}
              <AnimatePresence>
                {(voice.isRecording || voice.isPreviewing) && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="mb-3 overflow-hidden rounded-2xl border border-primary/30 bg-primary/5 p-4">
                    {voice.isRecording ? (
                      <div className="flex items-center gap-3">
                        <motion.div animate={{ scale: [1,1.2,1] }} transition={{ repeat: Infinity, duration: 1 }} className="h-3 w-3 rounded-full bg-red-500 shrink-0" />
                        <span className="text-sm font-medium flex-1">{voice.duration}s recording…</span>
                        {voice.transcript && <p className="text-xs text-muted-foreground italic truncate max-w-[120px]">"{voice.transcript}"</p>}
                        <motion.button type="button" onClick={voice.stopRecording} className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-500 text-white" whileTap={{ scale: 0.9 }}><Square className="h-3.5 w-3.5" /></motion.button>
                        <motion.button type="button" onClick={voice.cancelRecording} className="flex h-8 w-8 items-center justify-center rounded-xl border border-border" whileTap={{ scale: 0.9 }}><X className="h-3.5 w-3.5" /></motion.button>
                      </div>
                    ) : voice.isPreviewing ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <motion.button type="button" onClick={() => { audioPreviewRef.current?.load(); audioPreviewRef.current?.play(); }} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary" whileTap={{ scale: 0.9 }}><Play className="h-3.5 w-3.5" /></motion.button>
                          {voice.audioUrl && <audio ref={audioPreviewRef} src={voice.audioUrl} />}
                          <span className="text-xs text-muted-foreground shrink-0">{voice.duration}s</span>
                          <div className="flex-1" />
                          <motion.button type="button" onClick={voice.cancelRecording} className="flex h-8 w-8 items-center justify-center rounded-xl border border-border" whileTap={{ scale: 0.9 }}><RotateCcw className="h-3.5 w-3.5" /></motion.button>
                          <motion.button type="button" onClick={handleVoiceAccept} className="flex h-8 items-center gap-1.5 rounded-xl border border-border bg-secondary px-3 text-xs font-medium" whileTap={{ scale: 0.9 }}><Check className="h-3.5 w-3.5" /> Use Text</motion.button>
                          <motion.button type="button" onClick={sendVoiceNote} disabled={sending} className="flex h-8 items-center gap-1.5 rounded-xl gradient-bg px-3 text-xs font-medium text-primary-foreground disabled:opacity-50" whileTap={{ scale: 0.9 }}><Volume2 className="h-3.5 w-3.5" /> Send Audio</motion.button>
                        </div>
                <textarea value={voice.transcript} onChange={(e) => voice.setTranscript(e.target.value)} className="w-full rounded-xl border border-border bg-background/60 px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-border/70 resize-none" rows={2} placeholder="Transcript (edit if needed)…" />
                      </div>
                    ) : null}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Attached file preview */}
              <AnimatePresence>
                {attachedFile && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mb-2 overflow-hidden">
                    <div className="flex items-center gap-2.5 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
                      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                        attachedFile.type.startsWith("image/") ? "bg-cyan-500/15 text-cyan-400" : attachedFile.type.startsWith("video/") ? "bg-purple-500/15 text-purple-400" : attachedFile.type.startsWith("audio/") ? "bg-pink-500/15 text-pink-400" : "bg-muted text-muted-foreground")}>
                        {attachedFile.type.startsWith("image/") ? <ImageIcon className="h-4 w-4" /> : attachedFile.type.startsWith("video/") ? <Film className="h-4 w-4" /> : attachedFile.type.startsWith("audio/") ? <Headphones className="h-4 w-4" /> : <FileIcon className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate">{attachedFile.name}</p>
                        <p className="text-[10px] text-muted-foreground">{formatFileSize(attachedFile.size)}</p>
                      </div>
                      <button type="button" onClick={() => setAttachedFile(null)} className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Input row */}
              <div className="flex items-end gap-2">
                <input ref={fileInputRef} type="file" className="hidden"
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,.rar,.7z"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) { if (f.size > 25 * 1024 * 1024) alert("File must be under 25 MB"); else setAttachedFile(f); } e.target.value = ""; }} />

                <motion.button type="button" onClick={() => fileInputRef.current?.click()} disabled={sending}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-secondary/40 text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors disabled:opacity-40"
                  whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }} title="Attach file"><Paperclip className="h-4 w-4" /></motion.button>

                {voice.isSupported && (
                  <motion.button type="button"
                    onClick={() => voice.isRecording ? voice.stopRecording() : voice.startRecording()}
                    disabled={sending || voice.isPreviewing}
                    className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition-all disabled:opacity-40",
                      voice.isRecording ? "border-red-500/40 bg-red-500/10 text-red-500" : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground hover:border-primary/30")}
                    whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}>
                    {voice.isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </motion.button>
                )}

                <div className="flex-1 flex items-end gap-2 rounded-2xl border border-border bg-secondary/40 px-4 py-2 focus-within:border-border/70 transition-all min-w-0">
                  <textarea ref={inputRef} rows={1} value={input}
                    onChange={(e) => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`; }}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); (e.target as HTMLTextAreaElement).style.height = "auto"; } }}
                    placeholder={attachedFile ? "Add a caption…" : "Type a message…"}
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none min-w-0 py-0.5 resize-none max-h-32 overflow-y-auto leading-relaxed"
                    disabled={sending} />
                </div>

                <motion.button onClick={sendMessage} disabled={(!input.trim() && !attachedFile) || sending}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl gradient-bg text-primary-foreground shadow-sm disabled:opacity-40 transition-opacity"
                  whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }} aria-label="Send">
                  <Send className="h-4 w-4" />
                </motion.button>
              </div>

              <p className="mt-1.5 text-center text-[9px] text-muted-foreground/40 leading-none">
                Enter to send &middot; Shift+Enter new line &middot; Files up to 25 MB
              </p>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
            <div className="relative">
              <div className="flex h-24 w-24 items-center justify-center rounded-3xl gradient-bg shadow-xl">
                <MessageSquare className="h-12 w-12 text-primary-foreground" />
              </div>
              <div className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400 shadow-lg">
                <Check className="h-4 w-4 text-white" />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold">Your Messages</h3>
              <p className="max-w-xs text-sm text-muted-foreground leading-relaxed">
                Select a conversation from the sidebar, or start a new one from any company or supplier profile.
              </p>
            </div>
            {adminContact && user.role !== "admin" && (
              <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}
                onClick={contactAdmin} disabled={startingAdminChat}
                className="flex items-center gap-3 rounded-2xl border border-primary/25 bg-primary/5 hover:bg-primary/10 px-5 py-3 transition-all shadow-sm disabled:opacity-50">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-orange-600 shadow-sm">
                  <Shield className="h-5 w-5 text-white" />
                </div>
                <div className="text-start">
                  <p className="text-sm font-bold">Contact Platform Admin</p>
                  <p className="text-xs text-muted-foreground">Support, document questions &amp; approvals</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground ms-1" />
              </motion.button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
