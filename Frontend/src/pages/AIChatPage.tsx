import { MatchScoreRing } from "@/components/shared/MatchScoreRing";
import { GlassCard } from "@/components/shared/GlassCard";
import { Button } from "@/components/ui/button";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Bot, User, Send, Star, MapPin, Building2, Package, Wrench, DollarSign, Layers, Paperclip, X, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { api } from "@/lib/api";

/* ── Rich Markdown renderer: bold, italic, code, bullets, headings, tables ── */
function renderMarkdown(text: string) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: { ordered: boolean; text: string }[] = [];
  let tableRows: string[][] = [];
  let tableHeader: string[] | null = null;

  const inlineFormat = (s: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    let last = 0;
    const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
    let m;
    while ((m = regex.exec(s)) !== null) {
      if (m.index > last) parts.push(s.slice(last, m.index));
      if (m[2]) parts.push(<strong key={m.index} className="font-semibold">{m[2]}</strong>);
      else if (m[3]) parts.push(<em key={m.index}>{m[3]}</em>);
      else if (m[4]) parts.push(<code key={m.index} className="rounded bg-muted px-1 py-0.5 text-xs font-mono">{m[4]}</code>);
      last = m.index + m[0].length;
    }
    if (last < s.length) parts.push(s.slice(last));
    return parts.length === 1 ? parts[0] : <>{parts}</>;
  };

  const flushList = () => {
    if (!listItems.length) return;
    const ordered = listItems[0].ordered;
    const Tag = ordered ? "ol" : "ul";
    elements.push(
      <Tag key={`list-${elements.length}`} className={`my-1.5 ml-4 space-y-0.5 ${ordered ? "list-decimal" : "list-disc"}`}>
        {listItems.map((li, i) => (
          <li key={i} className="text-sm leading-relaxed">{inlineFormat(li.text)}</li>
        ))}
      </Tag>
    );
    listItems = [];
  };

  const flushTable = () => {
    if (!tableHeader && !tableRows.length) return;
    const headers = tableHeader || [];
    elements.push(
      <div key={`tbl-${elements.length}`} className="my-2 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          {headers.length > 0 && (
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {headers.map((h, i) => (
                  <th key={i} className="px-3 py-2 text-left font-semibold text-foreground">{inlineFormat(h.trim())}</th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {tableRows.map((row, ri) => (
              <tr key={ri} className={ri % 2 === 0 ? "" : "bg-muted/20"}>
                {row.map((cell, ci) => (
                  <td key={ci} className="px-3 py-2 text-muted-foreground border-t border-border/50">{inlineFormat(cell.trim())}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableHeader = null;
    tableRows = [];
  };

  const parseTableRow = (line: string): string[] | null => {
    if (!line.trim().startsWith("|")) return null;
    return line.split("|").slice(1, -1);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Table row detection
    const tRow = parseTableRow(line);
    if (tRow !== null) {
      const isSeparator = tRow.every(c => /^[-: ]+$/.test(c));
      if (isSeparator) continue; // skip the |---|---| line
      if (tableHeader === null) {
        flushList();
        tableHeader = tRow;
      } else {
        tableRows.push(tRow);
      }
      continue;
    }
    flushTable();

    // Bullet points
    const bulletMatch = line.match(/^\s*[-•*]\s+(.*)/);
    if (bulletMatch) { listItems.push({ ordered: false, text: bulletMatch[1] }); continue; }
    // Numbered list
    const numMatch = line.match(/^\s*\d+[.)]\s+(.*)/);
    if (numMatch) { listItems.push({ ordered: true, text: numMatch[1] }); continue; }
    flushList();

    // Headings
    const h3 = line.match(/^###\s+(.*)/);
    if (h3) { elements.push(<h4 key={i} className="mt-3 mb-1 text-sm font-bold text-foreground border-l-2 border-primary pl-2">{inlineFormat(h3[1])}</h4>); continue; }
    const h2 = line.match(/^##\s+(.*)/);
    if (h2) { elements.push(<h3 key={i} className="mt-3 mb-1 text-base font-bold text-foreground">{inlineFormat(h2[1])}</h3>); continue; }
    const h1 = line.match(/^#\s+(.*)/);
    if (h1) { elements.push(<h3 key={i} className="mt-3 mb-1 text-base font-bold text-foreground">{inlineFormat(h1[1])}</h3>); continue; }

    // Horizontal rule
    if (/^[-*_]{3,}$/.test(line.trim())) { elements.push(<hr key={i} className="my-2 border-border" />); continue; }

    // Empty line
    if (!line.trim()) { elements.push(<div key={i} className="h-2" />); continue; }

    // Normal paragraph
    elements.push(<p key={i} className="text-sm leading-relaxed">{inlineFormat(line)}</p>);
  }
  flushList();
  flushTable();
  return <div className="space-y-0.5">{elements}</div>;
}

interface Message {
  id: number;
  role: "user" | "ai";
  text: string;
}

interface Recommendation {
  type: "company" | "supplier";
  id: string;
  name: string;
  score: number;
  location: string;
  rating: number;
  reviews: number;
  specializations?: string[];
  price_range?: string;
  completed_projects?: number;
  categories?: string[];
  materials_count?: number;
}

export default function AIChatPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const userRole = user?.role || "client";

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const nextIdRef = useRef(1);
  const getNextId = useCallback(() => nextIdRef.current++, []);

  // Load greeting from backend on mount
  useEffect(() => {
    api.ai.chat([], user?.email || "", userRole).then((res) => {
      setMessages([{ id: getNextId(), role: "ai", text: res.response }]);
    }).catch(() => {
      setMessages([{ id: getNextId(), role: "ai", text: "Hello! 👋 I'm your AI Construction Assistant. Tell me about your project!" }]);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Role-specific suggested prompts
  const SUGGESTED = useMemo(() => {
    const prompts: Record<string, string[]> = {
      client: [
        "I want to build a 5 marla house in Lahore DHA, budget 80 lacs",
        "مجھے اسلام آباد میں 10 مرلہ مکان بنوانا ہے",
        "Find cement and steel suppliers in Karachi",
        "What's the current construction cost per sqft in Lahore?",
      ],
      company: [
        "Find best steel and cement suppliers in Lahore",
        "What are current market prices for construction materials?",
        "Suggest material alternatives to reduce cost",
        "Help me estimate cost for a 10 marla house grey structure",
      ],
      supplier: [
        "What are current cement prices across Pakistan?",
        "Am I pricing competitively for steel in Lahore?",
        "Which materials are most in demand right now?",
        "Help me analyze my pricing strategy",
      ],
      admin: [
        "Show me platform user summary",
        "Which are the top performing companies?",
        "List unapproved companies and suppliers",
        "What are the current market material prices?",
      ],
    };
    return prompts[userRole] || prompts.client;
  }, [userRole]);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;

    const update = () => {
      const threshold = 48;
      shouldAutoScrollRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    };

    update();
    el.addEventListener("scroll", update, { passive: true });
    return () => el.removeEventListener("scroll", update);
  }, []);

  useEffect(() => {
    if (!shouldAutoScrollRef.current) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

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
      const chatHistory = [...messages, { ...userMsg, text: text || `Please analyse the attached file: ${currentFile?.name}` }].map((m) => ({
        role: m.role === "ai" ? "assistant" : "user",
        content: m.text,
      }));

      let result: { response: string; recommendations?: unknown[] };
      if (currentFile) {
        result = await api.ai.chatWithFile(currentFile, chatHistory, user?.email || "", userRole);
      } else {
        result = await api.ai.chat(chatHistory, user?.email || "", userRole);
      }

      const aiMsg: Message = { id: getNextId(), role: "ai", text: result.response };
      setMessages((prev) => [...prev, aiMsg]);

      if (result.recommendations && result.recommendations.length > 0) {
        setRecommendations(result.recommendations as Recommendation[]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: getNextId(), role: "ai", text: "I'm having trouble connecting right now. Please try again in a moment." },
      ]);
    } finally {
      setIsTyping(false);
    }
  }, [getNextId, input, isTyping, messages, user?.email, userRole, attachedFile]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      handleSend();
    },
    [handleSend],
  );

  // Role-specific header title
  const headerTitle = useMemo(() => {
    const titles: Record<string, string> = {
      client: "AI Construction Consultant",
      company: "AI Business Advisor",
      supplier: "AI Market Analyst",
      admin: "AI Analytics Assistant",
    };
    return titles[userRole] || titles.client;
  }, [userRole]);

  const headerSubtitle = useMemo(() => {
    const subs: Record<string, string> = {
      client: "Find the perfect builder & supplier for your project",
      company: "Material sourcing & market intelligence",
      supplier: "Pricing strategy & demand insights",
      admin: "Platform analytics & insights",
    };
    return subs[userRole] || subs.client;
  }, [userRole]);

  return (
    <motion.div
      className="flex h-[calc(100vh-5rem)] gap-5"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      {/* ── Chat Panel ── */}
      <GlassCard interactive={false} className="flex flex-1 flex-col p-0 overflow-hidden card-shadow">

        {/* Header */}
        <div className="relative flex items-center gap-3 border-b border-border px-5 py-4 overflow-hidden">
          {/* Subtle glow behind bot icon */}
          <div className="absolute left-0 top-0 h-full w-32 bg-gradient-to-r from-primary/8 to-transparent pointer-events-none" />
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="relative flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl gradient-bg shadow-md">
            <Bot className="h-5 w-5 text-primary-foreground" />
            <div className="absolute inset-0 rounded-xl ring-2 ring-primary/20" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground leading-tight">{headerTitle}</h2>
            <p className="text-[11px] text-muted-foreground leading-tight">{headerSubtitle}</p>
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
          aria-relevant="additions"
          aria-label="Chat messages"
        >
          {/* Suggested prompts shown when only the greeting exists */}
          {messages.length === 1 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-wrap gap-2 pb-1"
            >
              {SUGGESTED.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => { setInput(s); }}
                  className="rounded-xl border border-border bg-secondary/50 px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/30 hover:bg-secondary hover:text-foreground transition-colors text-left"
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
                {/* Avatar */}
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl shadow-sm ${
                    msg.role === "ai" ? "gradient-bg" : "bg-secondary border border-border"
                  }`}
                >
                  {msg.role === "ai" ? (
                    <Bot className="h-4 w-4 text-primary-foreground" />
                  ) : (
                    <User className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>

                {/* Bubble */}
                <div
                  className={`max-w-[76%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                    msg.role === "ai"
                      ? "bg-secondary text-foreground rounded-bl-md"
                      : "gradient-bg text-primary-foreground rounded-br-md"
                  }`}
                  dir="auto"
                >
                  {msg.role === "ai" ? renderMarkdown(msg.text) : msg.text}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Typing indicator */}
          {isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-end gap-2.5"
              role="status"
              aria-label="Assistant is typing"
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
          {/* Attached file preview */}
          {attachedFile && (
            <div className="mb-2 flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
              <FileText className="h-4 w-4 text-primary shrink-0" />
              <span className="flex-1 truncate text-xs text-foreground">{attachedFile.name}</span>
              <span className="text-[10px] text-muted-foreground">{(attachedFile.size / 1024).toFixed(0)} KB</span>
              <button
                type="button"
                onClick={() => setAttachedFile(null)}
                className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-secondary transition-colors"
                aria-label="Remove file"
              >
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
            </div>
          )}
          <form className="flex items-center gap-2" onSubmit={handleSubmit}>
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.json,.txt,.md,.png,.jpg,.jpeg,.webp,.tiff,.bmp"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  if (f.size > 5 * 1024 * 1024) {
                    alert("File must be under 5 MB");
                  } else {
                    setAttachedFile(f);
                  }
                }
                e.target.value = "";
              }}
            />
            {/* Attach button */}
            <motion.button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isTyping}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-secondary/40 text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors disabled:opacity-40"
              aria-label="Attach file"
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
            >
              <Paperclip className="h-4 w-4" />
            </motion.button>
            <div className="flex-1 flex items-center gap-2 rounded-2xl border border-border bg-secondary/40 px-4 py-1 focus-within:border-primary/40 transition-colors">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={attachedFile ? "Add a message about the file..." : "Describe your project — location, budget, type..."}
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none min-w-0 py-2"
                aria-label="Message"
                disabled={isTyping}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
            </div>
            <motion.button
              type="submit"
              disabled={(!input.trim() && !attachedFile) || isTyping}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl gradient-bg text-primary-foreground shadow-sm disabled:opacity-40 transition-opacity"
              aria-label="Send message"
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
            >
              <Send className="h-4 w-4" />
            </motion.button>
          </form>
          <p className="mt-1.5 text-center text-[10px] text-muted-foreground/50">
            Enter to send · 📎 Attach files (PDF, images, Excel, etc.) · AI may make mistakes
          </p>
        </div>
      </GlassCard>

      {/* ── Recommendations Panel ── */}
      <div className="hidden lg:flex w-88 flex-col gap-0 overflow-hidden">
        <GlassCard interactive={false} className="flex flex-1 flex-col p-0 overflow-hidden card-shadow">
          {/* Panel header */}
          <div className="flex items-center gap-2.5 border-b border-border px-5 py-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Layers className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-foreground leading-tight">Top Matches</h3>
              <p className="text-[11px] text-muted-foreground leading-tight">
                {recommendations.length > 0 ? `${recommendations.length} results` : "AI-powered results"}
              </p>
            </div>
            {recommendations.length > 0 && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                {recommendations.length}
              </span>
            )}
          </div>

          {/* Recommendation list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {recommendations.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-4 py-12 px-4 text-center">
                <div className="relative">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary">
                    <Bot className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-xs">✦</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Gathering your requirements</p>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    Tell me your <strong className="text-foreground">city</strong>, <strong className="text-foreground">budget</strong>, and plot size — then I'll find your top 3 matches.
                  </p>
                  <div className="mt-3 space-y-1.5">
                    {["City / Area", "Budget (PKR)", "Plot size (marla/kanal)", "Construction type"].map((req) => (
                      <div key={req} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
                        {req}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              recommendations.map((rec, i) => (
                <motion.div
                  key={rec.id}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08, duration: 0.3 }}
                >
                  <div className="rounded-xl border border-border bg-card/60 p-3.5 hover:border-primary/20 hover:bg-card transition-all duration-200 relative overflow-hidden">
                    {/* Rank badge */}
                    <div className={`absolute top-0 right-0 rounded-bl-xl px-2 py-0.5 text-[9px] font-bold ${
                      i === 0 ? "bg-amber-500/15 text-amber-600" :
                      i === 1 ? "bg-slate-500/15 text-slate-500" :
                      "bg-orange-500/15 text-orange-600"
                    }`}>
                      #{i + 1} {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
                    </div>

                    {/* Top row: score + name */}
                    <div className="flex items-start gap-3">
                      <MatchScoreRing score={rec.score} size={44} />
                      <div className="flex-1 min-w-0 pr-8">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          {rec.type === "company" ? (
                            <Building2 className="h-3 w-3 text-primary shrink-0" />
                          ) : (
                            <Package className="h-3 w-3 text-orange-500 shrink-0" />
                          )}
                          <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                            rec.type === "company" ? "text-primary/70" : "text-orange-500/80"
                          }`}>
                            {rec.type === "company" ? "Construction Co." : "Supplier"}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-foreground truncate leading-tight">{rec.name}</h4>
                        <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{rec.location}</span>
                        </div>
                      </div>
                    </div>

                    {/* Rating */}
                    <div className="mt-2.5 flex items-center gap-2">
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, k) => (
                          <Star key={k} className={`h-3 w-3 ${ k < Math.round(rec.rating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/20"}`} />
                        ))}
                      </div>
                      <span className="text-xs font-semibold text-foreground">{rec.rating}</span>
                      <span className="text-[10px] text-muted-foreground">({rec.reviews} reviews)</span>
                    </div>

                    {/* Price range */}
                    {rec.price_range && (
                      <div className="mt-2 flex items-center gap-1.5">
                        <DollarSign className="h-3 w-3 text-emerald-500 shrink-0" />
                        <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">{rec.price_range}</span>
                      </div>
                    )}

                    {/* Completed projects */}
                    {rec.completed_projects != null && rec.completed_projects > 0 && (
                      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Building2 className="h-3 w-3 shrink-0" />
                        <span>{rec.completed_projects} projects completed</span>
                      </div>
                    )}

                    {/* Specialization pills */}
                    {rec.specializations && rec.specializations.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {rec.specializations.map((sp) => (
                          <span key={sp} className="inline-flex items-center gap-0.5 rounded-full bg-primary/8 px-2 py-0.5 text-[10px] font-medium text-primary/80">
                            <Wrench className="h-2.5 w-2.5" />{sp}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Category pills */}
                    {rec.categories && rec.categories.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {rec.categories.map((cat) => (
                          <span key={cat} className="inline-flex items-center gap-0.5 rounded-full bg-orange-500/8 px-2 py-0.5 text-[10px] font-medium text-orange-600 dark:text-orange-400">
                            <Package className="h-2.5 w-2.5" />{cat}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* CTA */}
                    <Button
                      variant="secondary"
                      size="sm"
                      className="mt-3 w-full h-8 text-xs font-semibold"
                      onClick={() =>
                        navigate(
                          rec.type === "company"
                            ? `/companies/${rec.id}`
                            : `/suppliers/${rec.id}`
                        )
                      }
                    >
                      View Profile →
                    </Button>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </GlassCard>
      </div>
    </motion.div>
  );
}
