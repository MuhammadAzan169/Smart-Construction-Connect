import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { mockCompanies } from "@/data/mockData";
import { MatchScoreRing } from "@/components/shared/MatchScoreRing";
import { useState, useEffect, useRef } from "react";
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

export default function AIChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, role: "ai", text: "Hello! 👋 I'm your AI Construction Assistant. Tell me about your project — budget, location, type — and I'll find the perfect match for you." },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg: Message = { id: Date.now(), role: "user", text: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    setTimeout(() => {
      const aiText = aiResponses[Math.floor(Math.random() * aiResponses.length)];
      setMessages((prev) => [...prev, { id: Date.now() + 1, role: "ai", text: aiText }]);
      setIsTyping(false);
    }, 1500 + Math.random() * 1000);
  };

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-7rem)] gap-6">
        {/* Chat panel */}
        <div className="flex flex-1 flex-col rounded-2xl border border-border bg-card card-shadow">
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
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <AnimatePresence>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${msg.role === "ai" ? "gradient-bg" : "bg-secondary"}`}>
                    {msg.role === "ai" ? <Bot className="h-4 w-4 text-primary-foreground" /> : <User className="h-4 w-4 text-secondary-foreground" />}
                  </div>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm ${
                    msg.role === "ai"
                      ? "bg-secondary text-secondary-foreground"
                      : "gradient-bg text-primary-foreground"
                  }`}>
                    {msg.text}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {isTyping && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
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
            <div className="flex gap-3">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Describe your construction project..."
                className="h-10 flex-1 rounded-xl border border-input bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="flex h-10 w-10 items-center justify-center rounded-xl gradient-bg text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Recommendations panel */}
        <div className="hidden w-96 flex-col gap-4 lg:flex">
          <h3 className="text-sm font-semibold text-foreground">Top Recommendations</h3>
          <div className="space-y-3 overflow-y-auto">
            {mockCompanies.slice(0, 4).map((company, i) => (
              <motion.div
                key={company.id}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ x: 4 }}
                className="rounded-2xl border border-border bg-card p-4 card-shadow transition-shadow hover:card-shadow-hover"
              >
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
                  <button className="flex-1 rounded-lg bg-primary/10 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20">
                    View Profile
                  </button>
                  <button className="flex items-center gap-1 rounded-lg bg-secondary py-1.5 px-3 text-xs font-medium text-secondary-foreground transition-colors hover:bg-accent">
                    Compare <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
