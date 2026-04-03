import { MatchScoreRing } from "@/components/shared/MatchScoreRing";
import { GlassCard } from "@/components/shared/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Bot, User, Send, Star, MapPin, ArrowRight, Building2, Package } from "lucide-react";
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

  return (
    <motion.div
      className="flex h-[calc(100svh-11rem)] gap-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Chat panel */}
      <GlassCard interactive={false} className="flex flex-1 flex-col p-0 card-shadow">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border px-6 py-4">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-1 rounded-lg p-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-bg">
            <Bot className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">AI Construction Assistant</h2>
            <p className="text-xs text-muted-foreground">Powered by Smart Matching</p>
          </div>
          <span className="ml-auto flex items-center gap-1.5 text-xs text-success">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse-ring" />
            Online
          </span>
        </div>

        {/* Messages */}
        <div
          ref={messagesContainerRef}
          className="flex-1 space-y-4 overflow-y-auto p-6"
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-label="Chat messages"
        >
          <AnimatePresence>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
              >
                <div
                  className={
                    `flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ` +
                    (msg.role === "ai" ? "gradient-bg" : "bg-secondary")
                  }
                >
                  {msg.role === "ai" ? (
                    <Bot className="h-4 w-4 text-primary-foreground" />
                  ) : (
                    <User className="h-4 w-4 text-secondary-foreground" />
                  )}
                </div>

                <div
                  className={
                    `max-w-[75%] rounded-2xl px-4 py-3 text-sm ` +
                    (msg.role === "ai"
                      ? "bg-secondary text-secondary-foreground"
                      : "gradient-bg text-primary-foreground")
                  }
                >
                  {msg.text}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {isTyping && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-3"
              role="status"
              aria-label="Assistant is typing"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-bg">
                <Bot className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="rounded-2xl bg-secondary px-4 py-3">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      animate={{ y: [0, -4, 0] }}
                      transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.15 }}
                      className="h-2 w-2 rounded-full bg-muted-foreground/40"
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border p-4">
          <form className="flex gap-3" onSubmit={handleSubmit}>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe your construction project..."
              className="flex-1 bg-background/40"
              aria-label="Message"
              disabled={isTyping}
            />
            <motion.button
              type="submit"
              disabled={!input.trim() || isTyping}
              className="inline-flex items-center justify-center rounded-xl h-9 w-9 gradient-bg text-primary-foreground disabled:opacity-50"
              aria-label="Send message"
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
            >
              <Send className="h-4 w-4" />
            </motion.button>
          </form>
        </div>
      </GlassCard>

      {/* Recommendations panel */}
      <div className="hidden w-96 flex-col gap-4 lg:flex">
        <h3 className="text-sm font-semibold text-foreground">Top Recommendations</h3>
        <div className="space-y-3 overflow-y-auto">
          {recommendations.length === 0 ? (
            <GlassCard interactive={false} className="p-4 text-center">
              <Bot className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">
                Describe your project and I'll find the best matches for you
              </p>
            </GlassCard>
          ) : (
            recommendations.map((rec, i) => (
              <motion.div
                key={rec.id}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ x: 4 }}
              >
                <GlassCard className="p-4">
                  <div className="flex items-start gap-3">
                    <MatchScoreRing score={rec.score} size={48} />
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        {rec.type === "company" ? (
                          <Building2 className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <Package className="h-3.5 w-3.5 text-highlight" />
                        )}
                        <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">
                          {rec.type === "company" ? "Construction" : "Supplier"}
                        </span>
                      </div>
                      <h4 className="mt-0.5 text-sm font-semibold text-foreground">{rec.name}</h4>
                      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {rec.location}
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-xs">
                        <Star className="h-3 w-3 fill-warning text-warning" />
                        <span className="font-medium text-foreground">{rec.rating}</span>
                        <span className="text-muted-foreground">({rec.reviews} reviews)</span>
                      </div>
                      {rec.price_range && (
                        <p className="mt-1 text-xs text-muted-foreground">💰 {rec.price_range}</p>
                      )}
                      {rec.specializations && rec.specializations.length > 0 && (
                        <p className="mt-1 text-xs text-muted-foreground">🔧 {rec.specializations.join(", ")}</p>
                      )}
                      {rec.categories && rec.categories.length > 0 && (
                        <p className="mt-1 text-xs text-muted-foreground">📦 {rec.categories.join(", ")}</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1"
                      onClick={() =>
                        navigate(
                          rec.type === "company"
                            ? `/companies/${rec.id}`
                            : `/suppliers/${rec.id}`
                        )
                      }
                    >
                      View profile
                    </Button>
                    <Button variant="outline" size="sm" className="flex items-center gap-1">
                      Details <ArrowRight className="h-3 w-3" />
                    </Button>
                  </div>
                </GlassCard>
              </motion.div>
            ))
          )}
        </div>
      </div>
      </motion.div>
   );
}
