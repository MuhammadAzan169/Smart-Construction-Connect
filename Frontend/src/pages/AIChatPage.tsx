import { MatchScoreRing } from "@/components/shared/MatchScoreRing";
import { GlassCard } from "@/components/shared/GlassCard";
import { Button } from "@/components/ui/button";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Bot, User, Send, Star, MapPin, Building2, Package, Wrench, DollarSign, Layers } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { api } from "@/lib/api";

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
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, role: "ai", text: "Hello! 👋 I'm your AI Construction Assistant. Tell me about your project — budget, location, type — and I'll find the perfect match for you." },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const nextIdRef = useRef(2);
  const getNextId = useCallback(() => nextIdRef.current++, []);

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
    if (!text || isTyping) return;

    const userMsg: Message = { id: getNextId(), role: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    try {
      const chatHistory = [...messages, userMsg].map((m) => ({
        role: m.role === "ai" ? "assistant" : "user",
        content: m.text,
      }));

      const result = await api.ai.chat(chatHistory, user?.email || "");

      const aiMsg: Message = { id: getNextId(), role: "ai", text: result.response };
      setMessages((prev) => [...prev, aiMsg]);

      if (result.recommendations && result.recommendations.length > 0) {
        setRecommendations(result.recommendations);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: getNextId(), role: "ai", text: "I'm having trouble connecting right now. Please try again in a moment." },
      ]);
    } finally {
      setIsTyping(false);
    }
  }, [getNextId, input, isTyping, messages, user?.email]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      handleSend();
    },
    [handleSend],
  );

  const SUGGESTED = [
    "I need a construction company in Lahore for a 5 marla house, budget 80 lacs",
    "Find me a reliable supplier for steel and cement in Karachi",
    "Looking for residential builders in Islamabad under 1 crore budget",
  ];

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
            <h2 className="text-sm font-bold text-foreground leading-tight">AI Construction Assistant</h2>
            <p className="text-[11px] text-muted-foreground leading-tight">Smart matching powered by AI</p>
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
                >
                  {msg.text}
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
          <form className="flex items-center gap-2" onSubmit={handleSubmit}>
            <div className="flex-1 flex items-center gap-2 rounded-2xl border border-border bg-secondary/40 px-4 py-1 focus-within:border-primary/40 transition-colors">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Describe your project — location, budget, type..."
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
              disabled={!input.trim() || isTyping}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl gradient-bg text-primary-foreground shadow-sm disabled:opacity-40 transition-opacity"
              aria-label="Send message"
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
            >
              <Send className="h-4 w-4" />
            </motion.button>
          </form>
          <p className="mt-1.5 text-center text-[10px] text-muted-foreground/50">
            Enter to send · AI may make mistakes — verify important details
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
                  <p className="text-sm font-medium text-foreground">No matches yet</p>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    Describe your project in the chat and I'll find the best contractors and suppliers for you.
                  </p>
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
                  <div className="rounded-xl border border-border bg-card/60 p-3.5 hover:border-primary/20 hover:bg-card transition-all duration-200">
                    {/* Top row: score + name */}
                    <div className="flex items-start gap-3">
                      <MatchScoreRing score={rec.score} size={44} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          {rec.type === "company" ? (
                            <Building2 className="h-3 w-3 text-primary shrink-0" />
                          ) : (
                            <Package className="h-3 w-3 text-orange-500 shrink-0" />
                          )}
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {rec.type === "company" ? "Construction" : "Supplier"}
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
                    <div className="mt-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, k) => (
                          <Star key={k} className={`h-3 w-3 ${ k < Math.round(rec.rating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/20"}`} />
                        ))}
                        <span className="ml-1 text-xs font-semibold text-foreground">{rec.rating}</span>
                        <span className="text-[10px] text-muted-foreground">({rec.reviews})</span>
                      </div>
                    </div>

                    {/* Tags */}
                    {rec.price_range && (
                      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <DollarSign className="h-3 w-3 text-emerald-500 shrink-0" />
                        <span>{rec.price_range}</span>
                      </div>
                    )}
                    {rec.specializations && rec.specializations.length > 0 && (
                      <div className="mt-1.5 flex items-start gap-1.5 text-[11px] text-muted-foreground">
                        <Wrench className="h-3 w-3 text-primary/70 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{rec.specializations.join(", ")}</span>
                      </div>
                    )}
                    {rec.categories && rec.categories.length > 0 && (
                      <div className="mt-1.5 flex items-start gap-1.5 text-[11px] text-muted-foreground">
                        <Package className="h-3 w-3 text-orange-400 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{rec.categories.join(", ")}</span>
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
                      View Profile
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
