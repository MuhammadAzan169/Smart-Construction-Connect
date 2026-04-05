import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { GlassCard } from "@/components/shared/GlassCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { api, type Conversation, type Message } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import {
  ArrowLeft,
  Circle,
  MessageSquare,
  Search,
  Send,
  User,
} from "lucide-react";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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

  if (!user) return null;

  return (
    <div className="flex h-[calc(100vh-5rem)] gap-0 overflow-hidden rounded-2xl border border-border bg-card">
      {/* Conversation list */}
      <div
        className={cn(
          "flex w-full flex-col border-r border-border md:w-80 lg:w-96",
          activeConvo && "hidden md:flex",
        )}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">Messages</h2>
          {conversations.some((c) => (c.unread[email] ?? 0) > 0) && (
            <Badge variant="destructive" className="ml-auto rounded-full px-2 text-xs">
              {conversations.reduce((sum, c) => sum + (c.unread[email] ?? 0), 0)}
            </Badge>
          )}
        </div>

        <div className="px-3 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations..."
              className="bg-background/40 pl-9 h-9"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="space-y-2 p-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-muted/30" />
              ))}
            </div>
          ) : filteredConvos.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
              <MessageSquare className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                {search ? "No conversations found." : "No conversations yet."}
              </p>
              <p className="text-xs text-muted-foreground">
                Start a conversation from a company or supplier profile.
              </p>
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {filteredConvos.map((convo) => {
                const unread = convo.unread[email] ?? 0;
                const isActive = activeConvo === convo.id;
                return (
                  <button
                    key={convo.id}
                    onClick={() => openConversation(convo.id)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors",
                      isActive
                        ? "bg-primary/10 border border-primary/20"
                        : "hover:bg-muted/40",
                    )}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <User className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className={cn("truncate text-sm", unread > 0 ? "font-bold text-foreground" : "font-medium text-foreground")}>
                          {getOtherName(convo)}
                        </p>
                        {convo.last_message && (
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {timeAgo(convo.last_message.timestamp)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className={cn("truncate text-xs", unread > 0 ? "text-foreground" : "text-muted-foreground")}>
                          {convo.last_message
                            ? `${convo.last_message.sender === email ? "You: " : ""}${convo.last_message.content}`
                            : "No messages yet"}
                        </p>
                        {unread > 0 && (
                          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                            {unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div
        className={cn(
          "flex flex-1 flex-col",
          !activeConvo && "hidden md:flex",
        )}
      >
        {activeConvo && activeConvoData ? (
          <>
            {/* Chat header */}
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <Button
                variant="ghost"
                size="sm"
                className="md:hidden"
                onClick={() => setActiveConvo(null)}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                <User className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{getOtherName(activeConvoData)}</p>
                <p className="text-xs text-muted-foreground">{getOtherEmail(activeConvoData)}</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-sm text-muted-foreground">Start the conversation by sending a message.</p>
                </div>
              ) : (
                <>
                  {messages.map((msg, idx) => {
                    const isMine = msg.sender === email;
                    const showDate =
                      idx === 0 ||
                      new Date(msg.timestamp).toDateString() !==
                        new Date(messages[idx - 1].timestamp).toDateString();
                    return (
                      <div key={msg.id}>
                        {showDate && (
                          <div className="flex justify-center py-2">
                            <span className="rounded-full bg-muted/50 px-3 py-1 text-[10px] text-muted-foreground">
                              {new Date(msg.timestamp).toLocaleDateString(undefined, {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          </div>
                        )}
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2 }}
                          className={cn("flex", isMine ? "justify-end" : "justify-start")}
                        >
                          <div
                            className={cn(
                              "max-w-[75%] rounded-2xl px-4 py-2.5",
                              isMine
                                ? "bg-primary text-primary-foreground rounded-br-md"
                                : "bg-muted text-foreground rounded-bl-md",
                            )}
                          >
                            {!isMine && (
                              <p className="mb-0.5 text-[10px] font-semibold opacity-70">
                                {msg.sender_name}
                              </p>
                            )}
                            <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                            <div className={cn("mt-1 flex items-center gap-1", isMine ? "justify-end" : "justify-start")}>
                              <span className={cn("text-[10px]", isMine ? "text-primary-foreground/60" : "text-muted-foreground")}>
                                {formatTime(msg.timestamp)}
                              </span>
                              {isMine && msg.read && (
                                <Circle className="h-2 w-2 fill-primary-foreground/60 text-primary-foreground/60" />
                              )}
                            </div>
                          </div>
                        </motion.div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-border p-3">
              <div className="flex items-center gap-2">
                <Input
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
                  className="flex-1 bg-background/40"
                  disabled={sending}
                />
                <Button
                  onClick={sendMessage}
                  disabled={!input.trim() || sending}
                  size="sm"
                  className="shrink-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <MessageSquare className="h-8 w-8 text-primary/50" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Your Messages</h3>
            <p className="max-w-sm text-center text-sm text-muted-foreground">
              Select a conversation to view messages, or start a new one from a company or supplier profile.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
