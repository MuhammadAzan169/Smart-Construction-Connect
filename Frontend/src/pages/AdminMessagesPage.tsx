import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, type Conversation, type Message } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import {
  ArrowLeft,
  Bot,
  Loader2,
  MessageSquare,
  Search,
  ShieldCheck,
  Sparkles,
  X,
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

function ChatAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const initials = getInitials(name) || "?";
  const color = avatarColor(name);
  const cls = size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm";
  return (
    <div className={cn("shrink-0 rounded-full bg-gradient-to-br flex items-center justify-center font-bold text-white shadow-sm", cls, color)}>
      {initials}
    </div>
  );
}

type ConvoWithCount = Conversation & { message_count: number };

export default function AdminMessagesPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [conversations, setConversations] = useState<ConvoWithCount[]>([]);
  const [activeConvo, setActiveConvo] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeConvoData, setActiveConvoData] = useState<Conversation | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summary, setSummary] = useState<{ text: string; messageCount: number; windowSize: number } | null>(null);

  const loadConversations = useCallback(async () => {
    try {
      const data = await api.messages.adminListConversations();
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

  const openConversation = async (id: string) => {
    setActiveConvo(id);
    setSummary(null);
    try {
      const res = await api.messages.adminGetMessages(id);
      setMessages(res.messages);
      setActiveConvoData(res.conversation);
    } catch {
      // ignore
    }
  };

  const summarizeChat = async (id: string) => {
    setSummaryLoading(true);
    try {
      const res = await api.messages.adminSummarize(id);
      setSummary({ text: res.summary, messageCount: res.message_count, windowSize: res.window_size });
    } catch {
      setSummary({ text: "Failed to generate summary. Please try again.", messageCount: 0, windowSize: 0 });
    } finally {
      setSummaryLoading(false);
    }
  };

  const filteredConvos = search.trim()
    ? conversations.filter((c) =>
        c.participant_names.some((n) => n.toLowerCase().includes(search.toLowerCase())) ||
        c.participants.some((p) => p.toLowerCase().includes(search.toLowerCase())),
      )
    : conversations;

  if (!user || user.role !== "admin") {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-center">
          <ShieldCheck className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium text-foreground">Admin Access Required</p>
          <p className="mt-1 text-xs text-muted-foreground">You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-5rem)] overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">

      {/* ── Sidebar: All Conversations ── */}
      <div
        className={cn(
          "flex w-full flex-col border-e border-border md:w-80 lg:w-96",
          activeConvo && "hidden md:flex",
        )}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500 shadow-sm">
            <ShieldCheck className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold text-foreground leading-tight">{t("adminMessages.title")}</h2>
            <p className="text-[11px] text-muted-foreground leading-tight">
              {conversations.length} total · Master log
            </p>
          </div>
        </div>

        <div className="px-4 py-3 border-b border-border/60">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full rounded-xl border border-transparent bg-secondary/50 ps-9 pe-3 h-9 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/30 transition-colors"
            />
          </div>
        </div>

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
              <MessageSquare className="h-7 w-7 text-muted-foreground/40" />
              <p className="text-sm font-medium text-foreground">
                {search ? "No results" : "No conversations found"}
              </p>
            </div>
          ) : (
            <div className="p-2 space-y-0.5">
              {filteredConvos.map((convo) => {
                const isActive = activeConvo === convo.id;
                return (
                  <motion.button
                    key={convo.id}
                    onClick={() => openConversation(convo.id)}
                    whileHover={{ x: 2 }}
                    transition={{ duration: 0.15 }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start transition-colors",
                      isActive ? "bg-violet-500/10 border border-violet-500/20" : "hover:bg-secondary/50",
                    )}
                  >
                    <div className="flex -space-x-3">
                      {convo.participant_names.slice(0, 2).map((name, i) => (
                        <ChatAvatar key={i} name={name} size="sm" />
                      ))}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground leading-tight">
                        {convo.participant_names.join(" & ")}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="truncate text-xs text-muted-foreground leading-tight">
                          {convo.last_message?.content ?? "No messages"}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-end">
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {convo.message_count} msg{convo.message_count !== 1 ? "s" : ""}
                      </Badge>
                      {convo.last_message && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
                          {timeAgo(convo.last_message.timestamp)}
                        </p>
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Chat Viewer ── */}
      <div
        className={cn(
          "flex flex-1 flex-col min-w-0",
          !activeConvo && "hidden md:flex",
        )}
      >
        {activeConvo && activeConvoData ? (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-border px-5 py-3">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden h-8 w-8 rounded-lg"
                onClick={() => setActiveConvo(null)}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex -space-x-3">
                {activeConvoData.participant_names.slice(0, 2).map((name, i) => (
                  <ChatAvatar key={i} name={name} size="md" />
                ))}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate leading-tight">
                  {activeConvoData.participant_names.join(" & ")}
                </p>
                <p className="text-[11px] text-muted-foreground truncate leading-tight">
                  {activeConvoData.participants.join(" · ")}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl gap-1.5 text-xs"
                onClick={() => summarizeChat(activeConvo)}
                disabled={summaryLoading}
              >
                {summaryLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Summarize with AI
              </Button>
            </div>

            {/* AI Summary Panel */}
            <AnimatePresence>
              {summary && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden border-b border-border"
                >
                  <div className="px-5 py-4 bg-violet-500/5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10">
                        <Bot className="h-4 w-4 text-violet-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-bold text-violet-600 dark:text-violet-400">AI Summary</p>
                          <button onClick={() => setSummary(null)} className="p-0.5 rounded hover:bg-secondary/50">
                            <X className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        </div>
                        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{summary.text}</p>
                        {summary.messageCount > 0 && (
                          <p className="mt-2 text-[10px] text-muted-foreground">
                            Based on {summary.windowSize} of {summary.messageCount} total messages
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Messages (read-only for admin) */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-1">
              {messages.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-sm text-muted-foreground">No messages in this conversation.</p>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isFirst = idx === 0 || messages[idx - 1].sender !== msg.sender;
                  const showDate =
                    idx === 0 ||
                    new Date(msg.timestamp).toDateString() !== new Date(messages[idx - 1].timestamp).toDateString();
                  const isLeft = msg.sender === activeConvoData.participants[0];

                  return (
                    <div key={msg.id}>
                      {showDate && (
                        <div className="flex justify-center py-4">
                          <span className="rounded-full bg-secondary/60 px-3 py-1 text-[10px] font-medium text-muted-foreground">
                            {new Date(msg.timestamp).toLocaleDateString(undefined, {
                              weekday: "short", month: "short", day: "numeric",
                            })}
                          </span>
                        </div>
                      )}
                      <div className={cn("flex items-end gap-2", isLeft ? "justify-start" : "justify-end", isFirst ? "mt-3" : "mt-0.5")}>
                        {isLeft && isFirst && <ChatAvatar name={msg.sender_name} size="sm" />}
                        {isLeft && !isFirst && <div className="w-8 shrink-0" />}

                        <div
                          className={cn(
                            "max-w-[72%] px-4 py-2.5 text-sm leading-relaxed shadow-sm",
                            isLeft
                              ? "bg-secondary text-foreground rounded-2xl rounded-bl-md"
                              : "bg-violet-500/15 text-foreground rounded-2xl rounded-br-md",
                          )}
                        >
                          {isFirst && (
                            <p className="mb-1 text-[10px] font-semibold opacity-60">{msg.sender_name}</p>
                          )}
                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                          <div className="mt-1 flex items-center gap-1.5">
                            <span className="text-[10px] text-muted-foreground tabular-nums">{formatTime(msg.timestamp)}</span>
                            {msg.status && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 leading-none">
                                {msg.status}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Admin footer */}
            <div className="border-t border-border px-5 py-3 bg-muted/20">
              <p className="text-center text-[11px] text-muted-foreground">
                <ShieldCheck className="inline h-3 w-3 me-1 align-[-2px]" />
                Admin view · Read-only master log · Soft-deleted messages are visible
              </p>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 p-8 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-violet-500/10">
              <ShieldCheck className="h-10 w-10 text-violet-500/60" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Admin Chat Oversight</h3>
              <p className="mt-2 max-w-xs text-sm text-muted-foreground leading-relaxed">
                Select a conversation to view the full unfiltered chat history. Use "Summarize with AI" for intelligent conversation analysis.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
