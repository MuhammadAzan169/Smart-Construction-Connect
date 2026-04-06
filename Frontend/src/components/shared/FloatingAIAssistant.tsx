import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, X, Send, Sparkles, ArrowRight, Building2, Users, Package } from "lucide-react";
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

const AI_RESPONSES: Record<string, string> = {
  company_benefits:
    "**Why register your construction company?**\n\n" +
    "• **Get discovered** — Clients searching for builders in your city find you instantly via AI matching\n" +
    "• **Win quality leads** — Receive quote requests from verified homeowners ready to build\n" +
    "• **Showcase your work** — Professional profile with project portfolio, pricing & reviews\n" +
    "• **AI-powered analytics** — Track your match score, response rate & market positioning\n" +
    "• **Beat competitors** — Our algorithm highlights companies with the best ratings, pricing & reliability\n\n" +
    "Registration is free — get started in under 5 minutes!",
  client_benefits:
    "**Benefits for homeowners & clients:**\n\n" +
    "• **AI-powered matching** — Describe your project and get matched with the top 3 builders scored by rating, price & reliability\n" +
    "• **Verified companies** — Every company is SECP-verified with document checks\n" +
    "• **Compare transparently** — Side-by-side pricing, reviews, timelines & materials used\n" +
    "• **Request quotes** — Submit your requirements and receive competitive quotes directly\n" +
    "• **Track everything** — Messages, requests, and project status all in one dashboard\n\n" +
    "It's completely free for clients!",
  features:
    "**Smart Construction Connect Features:**\n\n" +
    "🤖 **AI Assistant** — Intelligent recommendations based on your budget, location & requirements\n" +
    "🔍 **Semantic Search** — Find companies by specialization, city, or budget range\n" +
    "📊 **Match Scoring** — Every match gets a score based on 6+ data points\n" +
    "💬 **In-App Messaging** — Chat directly with companies and suppliers\n" +
    "📋 **Quote Requests** — Structured request workflow with status tracking\n" +
    "📁 **File Analysis** — Upload floor plans, BOQs or contracts — our AI reads them\n" +
    "✅ **Verified Profiles** — Document verification for trust & transparency\n" +
    "📈 **Analytics Dashboard** — Insights for companies, suppliers & admins",
  ai_matching:
    "**How our AI matching works:**\n\n" +
    "1. **You describe your project** — Budget, city, plot size, construction type\n" +
    "2. **AI analyzes 100+ companies** — Scored on rating, price competitiveness, location coverage, reliability & quality\n" +
    "3. **Top 3 matches returned** — With match percentages and detailed breakdowns\n" +
    "4. **Semantic understanding** — Our embeddings engine understands context, not just keywords\n\n" +
    "The more details you provide, the better the match. Try it after signing up!",
};

function getAIResponse(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("company") && (lower.includes("why") || lower.includes("register") || lower.includes("benefit")))
    return AI_RESPONSES.company_benefits;
  if (lower.includes("client") || lower.includes("homeowner") || lower.includes("benefit"))
    return AI_RESPONSES.client_benefits;
  if (lower.includes("feature") || lower.includes("what") || lower.includes("platform") || lower.includes("offer"))
    return AI_RESPONSES.features;
  if (lower.includes("ai") || lower.includes("match") || lower.includes("how") || lower.includes("work"))
    return AI_RESPONSES.ai_matching;
  if (lower.includes("price") || lower.includes("cost") || lower.includes("plan") || lower.includes("package"))
    return "We offer **3 plans**: Basic (Free), Pro (PKR 4,999/mo), and Premium (PKR 12,999/mo). Sign up to explore features and choose the best plan for you!";
  if (lower.includes("hello") || lower.includes("hi") || lower.includes("hey"))
    return "Hello! 👋 I'm the Smart Construction Connect assistant. I can help you understand the platform, our features, and how to get started. What would you like to know?";
  return (
    "Great question! Here's what I can help with:\n\n" +
    "• **Company registration** — Why & how to join\n" +
    "• **Client benefits** — What homeowners get\n" +
    "• **Platform features** — Full capability overview\n" +
    "• **AI matching** — How smart recommendations work\n\n" +
    "Try asking about any of these, or sign up to experience the full AI assistant inside the dashboard!"
  );
}

export function FloatingAIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      role: "ai",
      text: "Hi! 👋 I'm the Smart Construction Connect AI. Ask me about the platform, registration, or how our AI matching helps you find the perfect construction partner.",
    },
  ]);
  const [input, setInput] = useState("");
  const nextId = useRef(2);
  const bottomRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(
    (text?: string) => {
      const msg = (text || input).trim();
      if (!msg) return;

      const userMsg: Message = { id: nextId.current++, role: "user", text: msg };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");

      // Simulate AI response
      setTimeout(() => {
        const response = getAIResponse(msg);
        setMessages((prev) => [...prev, { id: nextId.current++, role: "ai", text: response }]);
      }, 400);
    },
    [input],
  );

  const handleQuickAction = useCallback(
    (key: string) => {
      const label = QUICK_ACTIONS.find((a) => a.key === key)?.label;
      if (label) handleSend(label);
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

              {/* Quick actions (shown at start) */}
              {messages.length <= 2 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {QUICK_ACTIONS.map((action) => (
                    <button
                      key={action.key}
                      onClick={() => handleQuickAction(action.key)}
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
                  className="flex-1 rounded-xl border border-border bg-secondary/40 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/40 transition-colors"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <button
                  type="submit"
                  disabled={!input.trim()}
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
