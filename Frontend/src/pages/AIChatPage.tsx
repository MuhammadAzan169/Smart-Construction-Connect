import { mockCompanies } from "@/data/mockData";
import { MatchScoreRing } from "@/components/shared/MatchScoreRing";
import { GlassCard } from "@/components/shared/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, User, Send, Star, MapPin, ArrowRight } from "lucide-react";

interface Message {
  id: number;
  role: "user" | "ai";
  text: string;
}

const aiResponses = [
  "Based on your requirements, I've found some excellent matches! Let me analyze the best construction companies for your project.",
  "I recommend Islamabad Elite Builders — they have a 94% match score for luxury residential projects in your area with excellent reviews.",
  "Comparing prices: For a 10-marla house in DHA Phase 5, expect PKR 2,350-4,200/sq ft for standard to executive quality. I'll show you the best options.",
  "Great question! I've updated the recommendations panel with companies that specialize in renovation projects within your budget range.",
  "For your budget of 8-12M PKR, I suggest looking at companies with 4.5+ ratings that have completed similar projects. Check the recommendations on the right!",
];

type Company = (typeof mockCompanies)[number];

function normalizeText(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
}

function pickAiResponse(userText: string) {
  const t = normalizeText(userText);
  const mentionsBudget = /\b(budget|pkr|rs)\b/.test(t) || /\b\d+(?:\.\d+)?\s*(?:m|mn|million|l|lac|lakh|k|thousand)\b/.test(t);
  const mentionsCompare = /\b(compare|comparison|vs)\b/.test(t);
  const mentionsRenovation = /\b(renovation|remodel|upgrade|repair)\b/.test(t);

  if (mentionsCompare) return aiResponses[2];
  if (mentionsRenovation) return aiResponses[3];
  if (mentionsBudget) return aiResponses[4];
  return aiResponses[Math.floor(Math.random() * aiResponses.length)];
}

function rankCompanies(companies: Company[], userText: string) {
  const q = normalizeText(userText);
  if (!q) return [...companies].sort((a, b) => b.matchScore - a.matchScore);

  const keywords = new Set(q.split(" ").filter(Boolean));
  const qHas = (s: string) => keywords.has(normalizeText(s));

  return [...companies]
    .map((c) => {
      let score = c.matchScore;

      // Strong signal: location
      if (q.includes(normalizeText(c.location))) score += 30;

      // Specialization signals (more forgiving: word-level)
      const specWords = c.specialization.flatMap((s) => normalizeText(s).split(" "));
      const specHits = specWords.reduce((acc, w) => (qHas(w) ? acc + 1 : acc), 0);
      score += Math.min(40, specHits * 10);

      // Quality signals
      score += Math.round(c.rating * 2);
      if (c.verified) score += 6;

      // Intent signals
      if (/\b(cheap|low|economy|basic)\b/.test(q) && /\b(luxury|executive|premium)\b/.test(normalizeText(c.priceRange))) {
        score -= 8;
      }
      if (/\b(luxury|premium|executive)\b/.test(q) && /\b(luxury)\b/.test(normalizeText(c.specialization.join(" ")))) {
        score += 10;
      }

      return { company: c, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.company);
}

export default function AIChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, role: "ai", text: "Hello! 👋 I'm your AI Construction Assistant. Tell me about your project — budget, location, type — and I'll find the perfect match for you." },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const nextIdRef = useRef(2);
  const getNextId = useCallback(() => nextIdRef.current++, []);

  const unmountedRef = useRef(false);
  const activeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aiQueueRef = useRef<string[]>([]);
  const processingRef = useRef(false);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      unmountedRef.current = true;
      if (activeTimeoutRef.current) {
        clearTimeout(activeTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;

    const update = () => {
      const threshold = 48; // px from bottom counts as "at bottom"
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

  const lastUserText = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.role === "user") return messages[i]!.text;
    }
    return "";
  }, [messages]);

  const recommendedCompanies = useMemo(() => {
    return rankCompanies(mockCompanies, lastUserText).slice(0, 4);
  }, [lastUserText]);

  const processQueue = useCallback(() => {
    if (processingRef.current) return;

    const nextUserText = aiQueueRef.current.shift();
    if (!nextUserText) {
      setIsTyping(false);
      return;
    }

    processingRef.current = true;
    setIsTyping(true);

    const delayMs = 1500 + Math.random() * 1000;
    activeTimeoutRef.current = setTimeout(() => {
      if (unmountedRef.current) return;

      const aiText = pickAiResponse(nextUserText);
      setMessages((prev) => [...prev, { id: getNextId(), role: "ai", text: aiText }]);
      processingRef.current = false;
      processQueue();
    }, delayMs);
  }, [getNextId]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text) return;

    setMessages((prev) => [...prev, { id: getNextId(), role: "user", text }]);
    setInput("");
    aiQueueRef.current.push(text);
    processQueue();
  }, [getNextId, input, processQueue]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      handleSend();
    },
    [handleSend],
  );

  return (
    <div className="flex h-[calc(100svh-11rem)] gap-6">
      {/* Chat panel */}
      <GlassCard interactive={false} className="flex flex-1 flex-col p-0 card-shadow">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border px-6 py-4">
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
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim()}
              className="rounded-xl"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </GlassCard>

      {/* Recommendations panel */}
      <div className="hidden w-96 flex-col gap-4 lg:flex">
        <h3 className="text-sm font-semibold text-foreground">Top Recommendations</h3>
        <div className="space-y-3 overflow-y-auto">
          {recommendedCompanies.map((company, i) => (
            <motion.div
              key={company.id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ x: 4 }}
            >
              <GlassCard className="p-4">
                <div className="flex items-start gap-3">
                  <MatchScoreRing score={company.matchScore} size={48} />
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-foreground">{company.name}</h4>
                    <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {company.location}
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-xs">
                      <Star className="h-3 w-3 fill-warning text-warning" />
                      <span className="font-medium text-foreground">{company.rating}</span>
                      <span className="text-muted-foreground">({company.reviews} reviews)</span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button variant="secondary" size="sm" className="flex-1">
                    View profile
                  </Button>
                  <Button variant="outline" size="sm" className="flex items-center gap-1">
                    Compare <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
