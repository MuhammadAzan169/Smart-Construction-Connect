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
  ArrowLeft, Check, CheckCheck, MessageSquare, Search, Send, Smile, Trash2, X,
  Paperclip, FileText, Mic, Image, Volume2, Download, Play,
  Square, RotateCcw,
} from "lucide-react";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getInitials(name: string): string {
  return name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
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
  let hash = 0;
  for (const c of str) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function ChatAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const initials = getInitials(name) || "?";
  const color = avatarColor(name);
  const cls = size === "sm" ? "h-8 w-8 text-xs" : size === "lg" ? "h-12 w-12 text-base" : "h-10 w-10 text-sm";
  return (
    <div className={cn("shrink-0 rounded-full bg-gradient-to-br flex items-center justify-center font-bold text-white shadow-sm", cls, color)}>
      {initials}
    </div>
  );
}

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
  const [deleteTarget, setDeleteTarget] = useState<{ type: "conversation"; id: string } | { type: "message"; convoId: string; msgId: string } | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioPreviewRef = useRef<HTMLAudioElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const [wsConnected, setWsConnected] = useState(false);
  const voice = useVoiceRecorder();

  const email = user?.email ?? "";
  const token = typeof window !== 'undefined' ? localStorage.getItem('scc_token') : null;

  const loadConversations = useCallback(async () => {
    try {
      const data = await api.messages.getConversations();
      setConversations(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // ── WebSocket connection ──
  useEffect(() => {
    if (!email || !token) return;

    let alive = true;

    function connect() {
      if (!alive) return;
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      const tokenParam = token ? `?token=${encodeURIComponent(token)}` : "";
      const ws = new WebSocket(`${proto}//${host}/api/messages/ws/${encodeURIComponent(email)}${tokenParam}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
      };

      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          if (data.type === "new_message") {
            // Refresh sidebar
            loadConversations();
            // If we're viewing this conversation, append the message
            if (data.conversation_id) {
              setActiveConvo((current) => {
                if (current === data.conversation_id) {
                  // Refresh the active conversation messages
                  api.messages.getMessages(data.conversation_id).then((res) => {
                    setMessages(res.messages);
                    setActiveConvoData(res.conversation);
                  }).catch(() => {});
                  setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
                }
                return current;
              });
            }
          } else if (data.type === "messages_read") {
            // Update read status for messages in active convo
            if (data.conversation_id) {
              setActiveConvo((current) => {
                if (current === data.conversation_id) {
                  setMessages((prev) => prev.map((m) => m.sender === email ? { ...m, status: "read" as const, read: true } : m));
                }
                return current;
              });
              loadConversations();
            }
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        setWsConnected(false);
        if (alive) {
          reconnectTimer.current = setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      alive = false;
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [email, token, loadConversations]);

  // Fallback polling every 30s (WS handles real-time)
  useEffect(() => {
    const interval = setInterval(() => {
      loadConversations();
      if (activeConvo) {
        api.messages.getMessages(activeConvo).then((res) => {
          setMessages(res.messages);
          setActiveConvoData(res.conversation);
        }).catch(() => {});
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [activeConvo, loadConversations]);

  const openConversation = async (id: string) => {
    setActiveConvo(id);
    try {
      const res = await api.messages.getMessages(id);
      setMessages(res.messages);
      setActiveConvoData(res.conversation);
      loadConversations();
    } catch {
      // ignore
    }
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      inputRef.current?.focus();
    }, 100);
  };

  const sendMessage = async () => {
    if ((!input.trim() && !attachedFile) || !activeConvo || sending) return;
    setSending(true);
    try {
      let attachment: { url: string; filename: string; size: number; type: string; content_type: string } | undefined;

      if (attachedFile) {
        const fileType = attachedFile.type.startsWith("image/") ? "image"
          : attachedFile.type.startsWith("video/") ? "video"
          : attachedFile.type.startsWith("audio/") ? "voice"
          : "file";
        const uploaded = await api.upload.messageFile(attachedFile, email, activeConvo, fileType as "file" | "voice" | "image" | "video");
        attachment = {
          url: uploaded.url,
          filename: uploaded.filename,
          size: uploaded.size,
          type: uploaded.file_type || fileType,
          content_type: uploaded.content_type,
        };
      }

      const content = input.trim() || (attachedFile ? `📎 ${attachedFile.name}` : "");
      const msg = await api.messages.sendMessage(activeConvo, content, attachment);
      setMessages((prev) => [...prev, msg]);
      setInput("");
      setAttachedFile(null);
      loadConversations();
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  };

  const handleVoiceAccept = useCallback(() => {
    const text = voice.acceptTranscript();
    if (text.trim()) setInput(text);
  }, [voice]);

  const sendVoiceNote = useCallback(async () => {
    if (!voice.audioBlob || !activeConvo || sending) return;
    const blob = voice.audioBlob;
    voice.cancelRecording();
    setSending(true);
    try {
      const audioFile = new File([blob], `voice-${Date.now()}.webm`, { type: "audio/webm" });
      const uploaded = await api.upload.messageFile(audioFile, email, activeConvo, "voice");
      const attachment = {
        url: uploaded.url,
        filename: uploaded.filename,
        size: uploaded.size,
        type: "voice",
        content_type: uploaded.content_type,
      };
      const msg = await api.messages.sendMessage(activeConvo, "🎤 Voice message", attachment);
      setMessages((prev) => [...prev, msg]);
      loadConversations();
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  }, [voice, activeConvo, sending, email, loadConversations]);

  const handleDeleteConversation = async (id: string) => {
    try {
      await api.messages.deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConvo === id) {
        setActiveConvo(null);
        setMessages([]);
        setActiveConvoData(null);
      }
    } catch {
      // ignore
    }
    setDeleteTarget(null);
  };

  const handleDeleteMessage = async (convoId: string, msgId: string) => {
    try {
      await api.messages.deleteMessage(convoId, msgId);
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
    } catch {
      // ignore
    }
    setDeleteTarget(null);
  };

  const getOtherName = (convo: Conversation) => {
    const idx = convo.participants.indexOf(email);
    const otherIdx = idx === 0 ? 1 : 0;
    return convo.participant_names[otherIdx] ?? convo.participants[otherIdx] ?? "Unknown";
  };

  const getOtherEmail = (convo: Conversation) => {
    return convo.participants.find((p) => p !== email) ?? "";
  };

  const filteredConvos = search.trim()
    ? conversations.filter((c) => getOtherName(c).toLowerCase().includes(search.toLowerCase()))
    : conversations;

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread[email] ?? 0), 0);

  const renderStatusIcon = (msg: Message, isMine: boolean) => {
    if (!isMine) return null;
    const status = msg.status ?? (msg.read ? "read" : "sent");
    if (status === "read") {
      return <CheckCheck className="h-3 w-3 text-primary-foreground/80" />;
    }
    if (status === "delivered") {
      return <CheckCheck className="h-3 w-3 text-primary-foreground/40" />;
    }
    return <Check className="h-3 w-3 text-primary-foreground/40" />;
  };

  if (!user) return null;

  return (
    <div className="flex h-[calc(100vh-5rem)] overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">

      {/* ── Delete Confirmation Modal ── */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => setDeleteTarget(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.15 }}
              className="mx-4 w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10">
                  <Trash2 className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    Delete {deleteTarget.type === "conversation" ? "Conversation" : "Message"}
                  </h3>
                  <p className="text-xs text-muted-foreground">This action cannot be undone.</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-5">
                {deleteTarget.type === "conversation"
                  ? "Are you sure you want to delete this entire conversation? It will be removed from your view."
                  : "Are you sure you want to delete this message? It will be removed from your view."}
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteTarget(null)}
                  className="rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (deleteTarget.type === "conversation") {
                      handleDeleteConversation(deleteTarget.id);
                    } else {
                      handleDeleteMessage(deleteTarget.convoId, deleteTarget.msgId);
                    }
                  }}
                  className="rounded-xl"
                >
                  Delete
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Image Lightbox Modal ── */}
      <AnimatePresence>
        {lightboxUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={() => setLightboxUrl(null)}
          >
            <motion.img
              src={lightboxUrl}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className="max-h-[85vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            <a
              href={lightboxUrl}
              download
              className="absolute bottom-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
              title="Download"
              onClick={(e) => e.stopPropagation()}
            >
              <Download className="h-4 w-4" />
            </a>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Conversation Sidebar ── */}
      <div
        className={cn(
          "flex w-full flex-col border-e border-border md:w-80 lg:w-96",
          activeConvo && "hidden md:flex",
        )}
      >
        {/* Sidebar header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-bg shadow-sm">
            <MessageSquare className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold text-foreground leading-tight">{t("messagesPage.title")}</h2>
            <p className="text-[11px] text-muted-foreground leading-tight">
              {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
            </p>
          </div>
          {totalUnread > 0 && (
            <Badge className="rounded-full px-2 py-0.5 text-[11px] font-bold bg-primary text-primary-foreground shadow-sm">
              {totalUnread}
            </Badge>
          )}
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-border/60">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations..."
              className="w-full rounded-xl border border-transparent bg-secondary/50 ps-9 pe-3 h-9 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/30 transition-colors"
            />
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto scroll-styled">
          {loading ? (
            <div className="space-y-1 p-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl p-3">
                  <div className="h-10 w-10 rounded-full animate-pulse bg-muted/50" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-2/3 rounded animate-pulse bg-muted/50" />
                    <div className="h-2.5 w-4/5 rounded animate-pulse bg-muted/30" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredConvos.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 p-10 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/30">
                <MessageSquare className="h-7 w-7 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-foreground">
                {search ? "No results" : "No conversations yet"}
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-[200px]">
                {search ? "Try a different search term." : "Start a conversation from a company or supplier profile."}
              </p>
            </div>
          ) : (
            <div className="p-2 space-y-0.5">
              {filteredConvos.map((convo) => {
                const unread = convo.unread[email] ?? 0;
                const isActive = activeConvo === convo.id;
                const otherName = getOtherName(convo);
                return (
                  <motion.div
                    key={convo.id}
                    whileHover={{ x: 2 }}
                    transition={{ duration: 0.15 }}
                    className={cn(
                      "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start transition-colors cursor-pointer",
                      isActive
                        ? "bg-primary/10 border border-primary/20"
                        : "hover:bg-secondary/50",
                    )}
                    onClick={() => openConversation(convo.id)}
                  >
                    <div className="relative">
                      <ChatAvatar name={otherName} size="md" />
                      {unread > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-primary border-2 border-card" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <p className={cn("truncate text-sm leading-tight", unread > 0 ? "font-bold text-foreground" : "font-medium text-foreground")}>
                          {otherName}
                        </p>
                        {convo.last_message && (
                          <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                            {timeAgo(convo.last_message.timestamp)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className={cn("truncate text-xs leading-tight", unread > 0 ? "text-foreground/80" : "text-muted-foreground")}>
                          {convo.last_message
                            ? `${convo.last_message.sender === email ? "You: " : ""}${convo.last_message.content}`
                            : "No messages yet"}
                        </p>
                        {unread > 0 && (
                          <span className="flex shrink-0 items-center justify-center rounded-full bg-primary min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-primary-foreground leading-none">
                            {unread}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget({ type: "conversation", id: convo.id });
                      }}
                      className="shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-destructive/10"
                      title="Delete conversation"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Chat Area ── */}
      <div
        className={cn(
          "flex flex-1 flex-col min-w-0",
          !activeConvo && "hidden md:flex",
        )}
      >
        {activeConvo && activeConvoData ? (
          <>
            {/* Chat header */}
            <div className="flex items-center gap-3 border-b border-border px-5 py-3">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden h-8 w-8 rounded-lg"
                onClick={() => setActiveConvo(null)}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <ChatAvatar name={getOtherName(activeConvoData)} size="md" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate leading-tight">
                  {getOtherName(activeConvoData)}
                </p>
                <div className="flex items-center gap-1.5">
                  <p className="text-[11px] text-muted-foreground truncate leading-tight">
                    {getOtherEmail(activeConvoData)}
                  </p>
                  {!wsConnected && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/15 px-1.5 py-0.5 text-[9px] font-medium text-yellow-500" title="Real-time connection lost — polling every 30s">
                      <span className="h-1.5 w-1.5 rounded-full bg-yellow-500 animate-pulse" />
                      Reconnecting
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-lg hover:bg-destructive/10"
                  onClick={() => setDeleteTarget({ type: "conversation", id: activeConvo })}
                  title="Delete conversation"
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                </Button>
                <div className="flex items-center gap-1.5 text-xs text-emerald-500">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="hidden sm:inline font-medium">Active</span>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto scroll-styled px-5 py-5 space-y-1">
              {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                    <Smile className="h-7 w-7 text-primary/60" />
                  </div>
                  <p className="text-sm font-medium text-foreground">Say hello!</p>
                  <p className="text-xs text-muted-foreground">Send the first message to start the conversation.</p>
                </div>
              ) : (
                <>
                  <AnimatePresence initial={false}>
                    {messages.map((msg, idx) => {
                      const isMine = msg.sender === email;
                      const showDate =
                        idx === 0 ||
                        new Date(msg.timestamp).toDateString() !==
                          new Date(messages[idx - 1].timestamp).toDateString();
                      const prevSame = idx > 0 && messages[idx - 1].sender === msg.sender;
                      const nextSame = idx < messages.length - 1 && messages[idx + 1].sender === msg.sender;

                      return (
                        <div key={msg.id}>
                          {showDate && (
                            <div className="flex justify-center py-4">
                              <span className="rounded-full bg-secondary/60 px-3 py-1 text-[10px] font-medium text-muted-foreground">
                                {new Date(msg.timestamp).toLocaleDateString(undefined, {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </span>
                            </div>
                          )}
                          <motion.div
                            initial={{ opacity: 0, y: 6, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ duration: 0.18 }}
                            className={cn(
                              "group/msg flex items-end gap-2",
                              isMine ? "justify-end" : "justify-start",
                              prevSame ? "mt-0.5" : "mt-3",
                            )}
                          >
                            {!isMine && !nextSame && <ChatAvatar name={getOtherName(activeConvoData)} size="sm" />}
                            {!isMine && nextSame && <div className="w-8 shrink-0" />}

                            <div className="relative">
                              <div
                                className={cn(
                                  "max-w-[85%] md:max-w-[78%] px-4 py-2.5 text-sm leading-relaxed shadow-sm",
                                  isMine
                                    ? "gradient-bg text-primary-foreground rounded-2xl rounded-br-md"
                                    : "bg-secondary text-foreground rounded-2xl rounded-bl-md",
                                )}
                              >
                                {!isMine && !prevSame && (
                                  <p className="mb-1 text-[10px] font-semibold opacity-60">
                                    {msg.sender_name}
                                  </p>
                                )}
                                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                                {msg.attachment && (
                                  <div className="mt-2">
                                    {msg.attachment.type === "image" || msg.attachment.content_type?.startsWith("image/") ? (
                                      <div className="relative group/img">
                                        <img
                                          src={msg.attachment.url}
                                          alt={msg.attachment.filename}
                                          className="max-w-[240px] rounded-xl border border-border/30 cursor-pointer hover:opacity-90 transition-opacity"
                                          loading="lazy"
                                          onClick={() => setLightboxUrl(msg.attachment!.url)}
                                        />
                                        <a
                                          href={msg.attachment.url}
                                          download={msg.attachment.filename}
                                          className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-lg bg-black/40 text-white opacity-0 group-hover/img:opacity-100 transition-opacity hover:bg-black/60"
                                          title="Download"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <Download className="h-3.5 w-3.5" />
                                        </a>
                                      </div>
                                    ) : msg.attachment.type === "voice" || msg.attachment.content_type?.startsWith("audio/") ? (
                                      <div className="flex items-center gap-2 rounded-xl bg-background/30 p-2">
                                        <Volume2 className="h-4 w-4 shrink-0 opacity-60" />
                                        <audio src={msg.attachment.url} controls className="h-8 flex-1 [&::-webkit-media-controls-panel]:bg-transparent" />
                                        <a href={msg.attachment.url} download={msg.attachment.filename} className="shrink-0 opacity-40 hover:opacity-80 transition-opacity" title="Download">
                                          <Download className="h-3.5 w-3.5" />
                                        </a>
                                      </div>
                                    ) : msg.attachment.type === "video" || msg.attachment.content_type?.startsWith("video/") ? (
                                      <div className="relative">
                                        <video
                                          src={msg.attachment.url}
                                          controls
                                          className="max-w-[280px] rounded-xl border border-border/30"
                                          preload="metadata"
                                        />
                                        <a
                                          href={msg.attachment.url}
                                          download={msg.attachment.filename}
                                          className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-lg bg-black/40 text-white opacity-0 hover:opacity-100 transition-opacity hover:bg-black/60"
                                          title="Download"
                                        >
                                          <Download className="h-3.5 w-3.5" />
                                        </a>
                                      </div>
                                    ) : msg.attachment.content_type === "application/pdf" ? (
                                      <div className="rounded-xl border border-border/30 overflow-hidden bg-background/20">
                                        <iframe
                                          src={msg.attachment.url}
                                          title={msg.attachment.filename}
                                          className="w-full h-48 border-0"
                                        />
                                        <a
                                          href={msg.attachment.url}
                                          download={msg.attachment.filename}
                                          className="flex items-center gap-2 border-t border-border/20 p-2.5 hover:bg-background/40 transition-colors"
                                        >
                                          <FileText className="h-4 w-4 shrink-0 opacity-60" />
                                          <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium truncate">{msg.attachment.filename}</p>
                                            <p className="text-[10px] opacity-60">{(msg.attachment.size / 1024).toFixed(0)} KB · PDF</p>
                                          </div>
                                          <Download className="h-3.5 w-3.5 shrink-0 opacity-40" />
                                        </a>
                                      </div>
                                    ) : (
                                      <a
                                        href={msg.attachment.url}
                                        download={msg.attachment.filename}
                                        className="flex items-center gap-2 rounded-xl bg-background/20 p-2.5 hover:bg-background/40 transition-colors"
                                      >
                                        <FileText className="h-4 w-4 shrink-0 opacity-60" />
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs font-medium truncate">{msg.attachment.filename}</p>
                                          <p className="text-[10px] opacity-60">{(msg.attachment.size / 1024).toFixed(0)} KB</p>
                                        </div>
                                        <Download className="h-3.5 w-3.5 shrink-0 opacity-40" />
                                      </a>
                                    )}
                                  </div>
                                )}
                                <div className={cn("mt-1 flex items-center gap-1", isMine ? "justify-end" : "justify-start")}>
                                  <span className={cn("text-[10px] tabular-nums", isMine ? "text-primary-foreground/60" : "text-muted-foreground")}>
                                    {formatTime(msg.timestamp)}
                                  </span>
                                  {renderStatusIcon(msg, isMine)}
                                </div>
                              </div>
                              {/* Per-message delete button */}
                              <button
                                onClick={() => setDeleteTarget({ type: "message", convoId: activeConvo, msgId: msg.id })}
                                className={cn(
                                  "absolute top-1 opacity-100 sm:opacity-0 sm:group-hover/msg:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-destructive/10",
                                  isMine ? "-start-7" : "-end-7",
                                )}
                                title="Delete message"
                              >
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

            {/* Input bar */}
            <div className="border-t border-border px-4 py-3">
              {/* Voice Recording Panel */}
              <AnimatePresence>
                {(voice.isRecording || voice.isPreviewing) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="mb-3 overflow-hidden rounded-2xl border border-primary/30 bg-primary/5 p-4"
                  >
                    {voice.isRecording ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="h-3 w-3 rounded-full bg-red-500 shrink-0" />
                          <span className="text-sm font-medium text-foreground">Recording… {voice.duration}s</span>
                          <div className="flex-1" />
                          <motion.button type="button" onClick={voice.stopRecording}
                            className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-500 text-white"
                            whileTap={{ scale: 0.9 }} title="Stop recording">
                            <Square className="h-3.5 w-3.5" />
                          </motion.button>
                          <motion.button type="button" onClick={voice.cancelRecording}
                            className="flex h-8 w-8 items-center justify-center rounded-xl border border-border text-muted-foreground hover:text-foreground"
                            whileTap={{ scale: 0.9 }} title="Cancel">
                            <X className="h-3.5 w-3.5" />
                          </motion.button>
                        </div>
                        {voice.transcript && (
                          <p className="text-xs text-muted-foreground italic truncate px-1">
                            "{voice.transcript}"
                          </p>
                        )}
                      </div>
                    ) : voice.isPreviewing ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <motion.button type="button"
                            onClick={() => { if (audioPreviewRef.current) { audioPreviewRef.current.currentTime = 0; audioPreviewRef.current.play(); } }}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary"
                            whileTap={{ scale: 0.9 }} title="Play back">
                            <Play className="h-3.5 w-3.5" />
                          </motion.button>
                          {voice.audioUrl && <audio ref={audioPreviewRef} src={voice.audioUrl} />}
                          <span className="text-xs text-muted-foreground shrink-0">{voice.duration}s</span>
                          <div className="flex-1" />
                          <motion.button type="button" onClick={voice.cancelRecording}
                            className="flex h-8 w-8 items-center justify-center rounded-xl border border-border text-muted-foreground hover:text-foreground"
                            whileTap={{ scale: 0.9 }} title="Re-record">
                            <RotateCcw className="h-3.5 w-3.5" />
                          </motion.button>
                          <motion.button type="button" onClick={handleVoiceAccept}
                            className="flex h-8 items-center gap-1.5 rounded-xl border border-border bg-secondary px-3 text-xs font-medium text-foreground hover:bg-secondary/80"
                            whileTap={{ scale: 0.9 }}>
                            <Check className="h-3.5 w-3.5" /> Use Text
                          </motion.button>
                          <motion.button type="button" onClick={sendVoiceNote} disabled={sending}
                            className="flex h-8 items-center gap-1.5 rounded-xl gradient-bg px-3 text-xs font-medium text-primary-foreground disabled:opacity-50"
                            whileTap={{ scale: 0.9 }}>
                            <Volume2 className="h-3.5 w-3.5" /> Send Audio
                          </motion.button>
                        </div>
                        <textarea
                          value={voice.transcript}
                          onChange={(e) => voice.setTranscript(e.target.value)}
                          className="w-full rounded-xl border border-border bg-background/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 resize-none"
                          rows={2}
                          placeholder="Transcript will appear here… (edit before using)"
                        />
                      </div>
                    ) : null}
                  </motion.div>
                )}
              </AnimatePresence>

              {attachedFile && (
                <div className="mb-2 flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
                  {attachedFile.type.startsWith("image/") ? (
                    <Image className="h-4 w-4 text-primary shrink-0" />
                  ) : attachedFile.type.startsWith("audio/") ? (
                    <Volume2 className="h-4 w-4 text-primary shrink-0" />
                  ) : (
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                  )}
                  <span className="flex-1 truncate text-xs text-foreground">{attachedFile.name}</span>
                  <span className="text-[10px] text-muted-foreground">{(attachedFile.size / 1024).toFixed(0)} KB</span>
                  <button type="button" onClick={() => setAttachedFile(null)} className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-secondary">
                    <X className="h-3 w-3 text-muted-foreground" />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef} type="file" className="hidden"
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,.rar"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      if (f.size > 25 * 1024 * 1024) alert("File must be under 25 MB");
                      else setAttachedFile(f);
                    }
                    e.target.value = "";
                  }}
                />
                <motion.button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sending}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-secondary/40 text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors disabled:opacity-40"
                  whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
                >
                  <Paperclip className="h-4 w-4" />
                </motion.button>
                {voice.isSupported && (
                  <motion.button
                    type="button"
                    onClick={() => voice.isRecording ? voice.stopRecording() : voice.startRecording()}
                    disabled={sending || voice.isPreviewing}
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition-colors disabled:opacity-40",
                      voice.isRecording
                        ? "border-red-500/40 bg-red-500/10 text-red-500 animate-pulse"
                        : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground hover:border-primary/30",
                    )}
                    whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
                    aria-label="Record voice"
                  >
                    {voice.isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </motion.button>
                )}
                <div className="flex-1 flex items-center gap-2 rounded-2xl border border-border bg-secondary/40 px-4 py-1 focus-within:border-primary/40 transition-colors">
                  <textarea
                    ref={inputRef}
                    rows={1}
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px';
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                        (e.target as HTMLTextAreaElement).style.height = 'auto';
                      }
                    }}
                    placeholder={attachedFile ? "Add a caption…" : "Type a message..."}
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none min-w-0 py-1.5 resize-none max-h-32 overflow-y-auto"
                    disabled={sending}
                  />
                </div>
                <motion.button
                  onClick={sendMessage}
                  disabled={(!input.trim() && !attachedFile) || sending}
                  whileHover={{ scale: 1.06 }}
                  whileTap={{ scale: 0.94 }}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl gradient-bg text-primary-foreground shadow-sm disabled:opacity-40 transition-opacity"
                  aria-label="Send"
                >
                  <Send className="h-4 w-4" />
                </motion.button>
              </div>
              <p className="mt-1.5 text-center text-[10px] text-muted-foreground/50">
                Enter to send · 📎 Files up to 25 MB · 🎤 Voice messages
              </p>
            </div>
          </>
        ) : (
          /* Empty state – no convo selected */
          <div className="flex flex-1 flex-col items-center justify-center gap-5 p-8 text-center">
            <div className="relative">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl gradient-bg shadow-lg">
                <MessageSquare className="h-10 w-10 text-primary-foreground" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Your Messages</h3>
              <p className="mt-2 max-w-xs text-sm text-muted-foreground leading-relaxed">
                Select a conversation from the sidebar, or start a new one from a company or supplier profile.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
