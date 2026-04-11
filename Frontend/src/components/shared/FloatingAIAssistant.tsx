import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, X, Send, Sparkles, ArrowRight, Building2, Users, Package, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface Message {
  id: number;
  role: "user" | "ai";
  text: string;
}

const QUICK_ACTIONS = [
  { icon: Building2, label: "Why should I register my construction company?" },
  { icon: Users, label: "How does this platform help homeowners?" },
  { icon: Package, label: "Benefits for material suppliers?" },
  { icon: Sparkles, label: "How does AI matching work?" },
];

const AI_API =
  typeof window !== "undefined" && window.location.port === "5173"
    ? "http://localhost:8000/api/ai/chat"
    : "/api/ai/chat";

async function fetchLandingResponse(history: { role: string; content: string }[]): Promise<string> {
  const res = await fetch(AI_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: history, user_email: "", user_role: "landing" }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  return data.response || "I didn't get a response. Please try again.";
}

/* ── Inline markdown → React nodes (bold, italic, code, bullets, tables) ── */
function renderMd(text: string) {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let listBuf: string[] = [];
  let tableHeader: string[] | null = null;
  let tableRows: string[][] = [];

  const fmt = (s: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    let last = 0;
    const rx = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
    let m: RegExpExecArray | null;
    rx.lastIndex = 0;
    while ((m = rx.exec(s)) !== null) {
      if (m.index > last) parts.push(s.slice(last, m.index));
      if (m[2]) parts.push(<strong key={m.index}>{m[2]}</strong>);
      else if (m[3]) parts.push(<em key={m.index}>{m[3]}</em>);
      else if (m[4]) parts.push(<code key={m.index} className="rounded bg-muted px-1 text-[10px]">{m[4]}</code>);
      last = m.index + m[0].length;
    }
    if (last < s.length) parts.push(s.slice(last));
    return parts.length === 1 ? parts[0] : <>{parts}</>;
  };

  const flushList = () => {
    if (!listBuf.length) return;
    out.push(
      <ul key={`ul-${out.length}`} className="ms-3 list-disc space-y-0.5">
        {listBuf.map((l, i) => <li key={i} className="text-xs leading-relaxed">{fmt(l)}</li>)}
      </ul>
    );
    listBuf = [];
  };

  const flushTable = () => {
    if (!tableHeader && !tableRows.length) return;
    out.push(
      <div key={`tbl-${out.length}`} className="my-1.5 overflow-x-auto rounded border border-border text-[10px]">
        <table className="w-full">
          {tableHeader && (
            <thead>
              <tr className="bg-muted/60">
                {tableHeader.map((h, i) => (
                  <th key={i} className="px-2 py-1 text-start font-semibold text-foreground">{fmt(h.trim())}</th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {tableRows.map((row, ri) => (
              <tr key={ri} className={ri % 2 ? "bg-muted/20" : ""}>
                {row.map((cell, ci) => (
                  <td key={ci} className="px-2 py-1 text-muted-foreground border-t border-border/40">{fmt(cell.trim())}</td>
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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith("|")) {
      const cells = line.split("|").slice(1, -1);
      const isSep = cells.every(c => /^[-: ]+$/.test(c));
      if (isSep) continue;
      if (tableHeader === null) { flushList(); tableHeader = cells; }
      else tableRows.push(cells);
      continue;
    }
    flushTable();
    const bullet = line.match(/^\s*[-•*]\s+(.*)/);
    if (bullet) { listBuf.push(bullet[1]); continue; }
    const num = line.match(/^\s*\d+[.)]\s+(.*)/);
    if (num) { listBuf.push(num[1]); continue; }
    flushList();
    if (!line.trim()) { out.push(<div key={i} className="h-1.5" />); continue; }
    const h = line.match(/^#{1,3}\s+(.*)/);
    if (h) { out.push(<p key={i} className="text-xs font-bold mt-1">{fmt(h[1])}</p>); continue; }
    out.push(<p key={i} className="text-xs leading-relaxed">{fmt(line)}</p>);
  }
  flushList();
  flushTable();
  return <div className="space-y-0.5">{out}</div>;
}

export function FloatingAIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const nextId = useRef(1);
  const bottomRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const greetingLoaded = useRef(false);

  // Load greeting from backend when opened
  useEffect(() => {
    if (!isOpen || greetingLoaded.current) return;
    greetingLoaded.current = true;
    fetchLandingResponse([]).then((res) => {
      setMessages([{ id: nextId.current++, role: "ai", text: res }]);
    }).catch(() => {
      setMessages([{
        id: nextId.current++,
        role: "ai",
        text: "👋 Welcome to **Smart Construction Connect**!\n\nI can tell you everything about our platform — how we help homeowners find builders, why companies should register, and more.\n\nWhat would you like to know?",
      }]);
    });
  }, [isOpen]);

  // Reset greeting on close so re-opening refreshes
  useEffect(() => {
    if (!isOpen) {
      greetingLoaded.current = false;
    }
  }, [isOpen]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = useCallback(
    async (text?: string) => {
      const msg = (text || input).trim();
      if (!msg || isTyping) return;

      const userMsg: Message = { id: nextId.current++, role: "user", text: msg };
      setMessages((prev) => [...prev, userMsg].slice(-50));
      setInput("");
      setIsTyping(true);

      try {
        const history = [...messages, userMsg].map((m) => ({
          role: m.role === "ai" ? "assistant" : "user",
          content: m.text,
        }));
        const response = await fetchLandingResponse(history);
        setMessages((prev) => [...prev, { id: nextId.current++, role: "ai", text: response }].slice(-50));
      } catch {
        setMessages((prev) => [
          ...prev,
          { id: nextId.current++, role: "ai", text: "Sorry, I'm having trouble connecting. Sign up to use the full AI assistant! 🚀" },
        ]);
      } finally {
        setIsTyping(false);
      }
    },
    [input, isTyping, messages],
  );

  return (
    <>
      {/* Floating button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 end-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/25 transition-shadow hover:shadow-xl hover:shadow-primary/30"
            aria-label="Open AI Assistant"
          >
            <Bot className="h-6 w-6" />
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-white">
              AI
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className="fixed bottom-6 end-6 z-50 flex h-[520px] w-[380px] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-border bg-gradient-to-r from-primary/5 to-transparent px-4 py-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-sm">
                <Bot className="h-4.5 w-4.5 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-foreground leading-tight">Smart Construction AI</h3>
                <p className="text-[10px] text-muted-foreground leading-tight">Ask anything about the platform</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-secondary transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn("flex gap-2", msg.role === "user" ? "flex-row-reverse" : "")}
                >
                  {msg.role === "ai" && (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80 shadow-sm">
                      <Bot className="h-3.5 w-3.5 text-primary-foreground" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[82%] rounded-2xl px-3 py-2",
                      msg.role === "ai"
                        ? "bg-secondary text-foreground rounded-bl-md"
                        : "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground rounded-br-md",
                    )}
                    dir="auto"
                  >
                    {msg.role === "ai" ? renderMd(msg.text) : <span className="text-xs">{msg.text}</span>}
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80 shadow-sm">
                    <Bot className="h-3.5 w-3.5 text-primary-foreground" />
                  </div>
                  <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-secondary px-3 py-2">
                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Thinking…</span>
                  </div>
                </div>
              )}

              {/* Quick actions */}
              {messages.length <= 1 && !isTyping && messages.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {QUICK_ACTIONS.map((a) => (
                    <button
                      key={a.label}
                      onClick={() => handleSend(a.label)}
                      className="flex items-center gap-1.5 rounded-xl border border-border bg-secondary/50 px-2.5 py-1.5 text-[11px] text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors"
                    >
                      <a.icon className="h-3 w-3" />
                      {a.label}
                    </button>
                  ))}
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* CTA */}
            <div className="border-t border-border bg-primary/5 px-4 py-2">
              <button
                onClick={() => navigate("/signup")}
                className="flex w-full items-center justify-between rounded-xl bg-gradient-to-r from-primary to-primary/80 px-3 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:shadow-md transition-shadow"
              >
                <span>Sign up for the full AI experience</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Input */}
            <div className="border-t border-border px-3 py-2.5">
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about the platform… (English/Urdu)"
                  disabled={isTyping}
                  className="flex-1 rounded-xl border border-border bg-secondary/40 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/40 transition-colors disabled:opacity-60"
                  dir="auto"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isTyping}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-sm disabled:opacity-40 transition-opacity"
                  aria-label="Send"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
