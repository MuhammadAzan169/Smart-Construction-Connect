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
  { icon: Building2, label: "Why register my company?", key: "company_benefits" },
  { icon: Users, label: "Benefits for clients", key: "client_benefits" },
  { icon: Package, label: "Platform features", key: "features" },
  { icon: Sparkles, label: "How does AI matching work?", key: "ai_matching" },
];

const AI_API =
  typeof window !== "undefined" && window.location.port === "5173"
    ? "http://localhost:8000/api/ai/chat"
    : "/api/ai/chat";

async function fetchAIResponse(conversationHistory: { role: string; content: string }[]): Promise<string> {
  const res = await fetch(AI_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: conversationHistory,
      user_email: "",
      user_role: "client",
    }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  return data.response || "I didn't get a response. Please try again.";
}

export function FloatingAIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      role: "ai",
      text: "Hi! ðŸ‘‹ I'm the Smart Construction Connect AI. Ask me about finding construction companies, material suppliers, or how the platform works.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const nextId = useRef(2);
  const bottomRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = useCallback(
    async (text?: string) => {
      const msg = (text || input).trim();
      if (!msg || isTyping) return;

      const userMsg: Message = { id: nextId.current++, role: "user", text: msg };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsTyping(true);

      try {
        // Build conversation history for the API (exclude the initial greeting)
        const history = [...messages, userMsg]
          .filter((m) => !(m.id === 1 && m.role === "ai"))
          .map((m) => ({
            role: m.role === "ai" ? "assistant" : "user",
            content: m.text,
          }));

        const response = await fetchAIResponse(history);
        setMessages((prev) => [...prev, { id: nextId.current++, role: "ai", text: response }]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: nextId.current++,
            role: "ai",
            text: "Sorry, I'm having trouble connecting right now. Please try again or sign up to use the full AI assistant.",
          },
        ]);
      } finally {
        setIsTyping(false);
      }
    },
    [input, isTyping, messages],
  );

  const handleQuickAction = useCallback(
    (label: string) => {
      handleSend(label);
    },
    [handleSend],
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
            className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/25 transition-shadow hover:shadow-xl hover:shadow-primary/30"
            aria-label="Open AI Assistant"
          >
            <Bot className="h-6 w-6" />
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-white">
              AI
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className="fixed bottom-6 right-6 z-50 flex h-[520px] w-[380px] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-border bg-gradient-to-r from-primary/5 to-transparent px-4 py-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-sm">
                <Bot className="h-4.5 w-4.5 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-foreground leading-tight">AI Assistant</h3>
                <p className="text-[10px] text-muted-foreground leading-tight">Powered by real company data</p>
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
                  className={cn(
                    "flex gap-2",
                    msg.role === "user" ? "flex-row-reverse" : "",
                  )}
                >
                  {msg.role === "ai" && (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80 shadow-sm">
                      <Bot className="h-3.5 w-3.5 text-primary-foreground" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-3 py-2 text-xs leading-relaxed",
                      msg.role === "ai"
                        ? "bg-secondary text-foreground rounded-bl-md"
                        : "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground rounded-br-md",
                    )}
                  >
                    <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{
                      __html: msg.text
                        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                        .replace(/\n/g, "<br />"),
                    }} />
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {isTyping && (
                <div className="flex gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80 shadow-sm">
                    <Bot className="h-3.5 w-3.5 text-primary-foreground" />
                  </div>
                  <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-secondary px-3 py-2">
                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Thinkingâ€¦</span>
                  </div>
                </div>
              )}

              {/* Quick actions (shown at start) */}
              {messages.length <= 1 && !isTyping && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {QUICK_ACTIONS.map((action) => (
                    <button
                      key={action.key}
                      onClick={() => handleQuickAction(action.label)}
                      className="flex items-center gap-1.5 rounded-xl border border-border bg-secondary/50 px-2.5 py-1.5 text-[11px] text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors"
                    >
                      <action.icon className="h-3 w-3" />
                      {action.label}
                    </button>
                  ))}
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* CTA Banner */}
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
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about the platform..."
                  disabled={isTyping}
                  className="flex-1 rounded-xl border border-border bg-secondary/40 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/40 transition-colors disabled:opacity-60"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
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
