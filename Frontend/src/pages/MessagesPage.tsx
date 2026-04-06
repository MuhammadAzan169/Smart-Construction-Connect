import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, type Conversation, type Message } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import {
  ArrowLeft,
  CheckCheck,
  MessageSquare,
  Search,
  Send,
  Smile,
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
  const user = useAuthStore((s) => s.user);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvo, setActiveConvo] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeConvoData, setActiveConvoData] = useState<Conversation | null>(null);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const email = user?.email ?? "";

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

  // Poll for new messages every 10s
  useEffect(() => {
    const interval = setInterval(() => {
      loadConversations();
      if (activeConvo) {
        api.messages.getMessages(activeConvo).then((res) => {
          setMessages(res.messages);
          setActiveConvoData(res.conversation);
        }).catch(() => {});
      }
    }, 10_000);
    return () => clearInterval(interval);
  }, [activeConvo, loadConversations]);

  const openConversation = async (id: string) => {
    setActiveConvo(id);
    try {
      const res = await api.messages.getMessages(id);
      setMessages(res.messages);
      setActiveConvoData(res.conversation);
      // Refresh conversations to clear unread
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
    if (!input.trim() || !activeConvo || sending) return;
    setSending(true);
    try {
      const msg = await api.messages.sendMessage(activeConvo, input.trim());
      setMessages((prev) => [...prev, msg]);
      setInput("");
      loadConversations();
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
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

  if (!user) return null;

  return (
    <div className="flex h-[calc(100vh-5rem)] overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">

      {/* ── Conversation Sidebar ── */}
      <div
        className={cn(
          "flex w-full flex-col border-r border-border md:w-80 lg:w-96",
          activeConvo && "hidden md:flex",
        )}
      >
        {/* Sidebar header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-bg shadow-sm">
            <MessageSquare className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold text-foreground leading-tight">Messages</h2>
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
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations..."
              className="w-full rounded-xl border border-transparent bg-secondary/50 pl-9 pr-3 h-9 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/30 transition-colors"
            />
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
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
                  <motion.button
                    key={convo.id}
                    onClick={() => openConversation(convo.id)}
                    whileHover={{ x: 2 }}
                    transition={{ duration: 0.15 }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                      isActive
                        ? "bg-primary/10 border border-primary/20"
                        : "hover:bg-secondary/50",
                    )}
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
                  </motion.button>
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
                <p className="text-[11px] text-muted-foreground truncate leading-tight">
                  {getOtherEmail(activeConvoData)}
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-500">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="hidden sm:inline font-medium">Active</span>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-1">
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
                              "flex items-end gap-2",
                              isMine ? "justify-end" : "justify-start",
                              prevSame ? "mt-0.5" : "mt-3",
                            )}
                          >
                            {!isMine && !nextSame && <ChatAvatar name={getOtherName(activeConvoData)} size="sm" />}
                            {!isMine && nextSame && <div className="w-8 shrink-0" />}

                            <div
                              className={cn(
                                "max-w-[72%] px-4 py-2.5 text-sm leading-relaxed shadow-sm",
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
                              <div className={cn("mt-1 flex items-center gap-1", isMine ? "justify-end" : "justify-start")}>
                                <span className={cn("text-[10px] tabular-nums", isMine ? "text-primary-foreground/60" : "text-muted-foreground")}>
                                  {formatTime(msg.timestamp)}
                                </span>
                                {isMine && (
                                  <CheckCheck className={cn("h-3 w-3", msg.read ? "text-primary-foreground/80" : "text-primary-foreground/40")} />
                                )}
                              </div>
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
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 rounded-2xl border border-border bg-secondary/40 px-4 py-1 focus-within:border-primary/40 transition-colors">
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Type a message..."
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none min-w-0 py-1.5"
                    disabled={sending}
                  />
                </div>
                <motion.button
                  onClick={sendMessage}
                  disabled={!input.trim() || sending}
                  whileHover={{ scale: 1.06 }}
                  whileTap={{ scale: 0.94 }}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl gradient-bg text-primary-foreground shadow-sm disabled:opacity-40 transition-opacity"
                  aria-label="Send"
                >
                  <Send className="h-4 w-4" />
                </motion.button>
              </div>
              <p className="mt-1.5 text-center text-[10px] text-muted-foreground/50">
                Enter to send · Shift+Enter for new line
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
