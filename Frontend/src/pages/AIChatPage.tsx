import { renderMarkdown } from "@/components/shared/MarkdownRenderer";
import { MatchScoreRing } from "@/components/shared/MatchScoreRing";
import { GlassCard } from "@/components/shared/GlassCard";
import { Button } from "@/components/ui/button";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Bot, User, Send, Star, MapPin, Building2, Package, Wrench,
  DollarSign, Layers, Paperclip, X, FileText, Mic, Square,
  Play, RotateCcw, Check, Image as ImageIcon, FileSpreadsheet,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { api } from "@/lib/api";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";

/* ── Utility helpers ── */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (["jpg", "jpeg", "png", "gif", "webp", "bmp", "tiff"].includes(ext)) return <ImageIcon className="h-4 w-4 text-blue-500" />;
  if (["pdf"].includes(ext)) return <FileText className="h-4 w-4 text-red-500" />;
  if (["xls", "xlsx", "csv"].includes(ext)) return <FileSpreadsheet className="h-4 w-4 text-green-500" />;
  return <FileText className="h-4 w-4 text-primary" />;
}

interface Message {
  id: number;
  role: "user" | "ai";
  text: string;
  isStreaming?: boolean;
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
  const [sessionFiles, setSessionFiles] = useState<{ id: string; filename: string; summary: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const nextIdRef = useRef(1);
  const getNextId = useCallback(() => nextIdRef.current++, []);

  // Voice recorder
  const voice = useVoiceRecorder();
  const audioPreviewRef = useRef<HTMLAudioElement>(null);

  // Load greeting and session files on mount
  useEffect(() => {
    api.ai.chat([], user?.email || "", userRole).then((res) => {
      setMessages([{ id: getNextId(), role: "ai", text: res.response }]);
    }).catch(() => {
      setMessages([{ id: getNextId(), role: "ai", text: "Hello! 👋 I'm your AI Construction Assistant. Tell me about your project!" }]);
    });

    // Load session files
    if (user?.email) {
      api.ai.getSessionFiles(user.email).then((res) => {
        setSessionFiles(res.files);
      }).catch(() => {});
    }
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

      if (currentFile) {
        // Non-streaming for file uploads
        const result = await api.ai.chatWithFile(currentFile, chatHistory, user?.email || "", userRole);
        setMessages((prev) => [...prev, { id: getNextId(), role: "ai", text: result.response }]);
        if (result.recommendations && result.recommendations.length > 0) {
          setRecommendations(result.recommendations as Recommendation[]);
        }
        // Refresh session files
        if (user?.email) {
          api.ai.getSessionFiles(user.email).then((res) => setSessionFiles(res.files)).catch(() => {});
        }
      } else {
        // Streaming response
        const streamMsgId = getNextId();
        setMessages((prev) => [...prev, { id: streamMsgId, role: "ai", text: "", isStreaming: true }]);

        let fullText = "";
        for await (const chunk of api.ai.chatStream(chatHistory, user?.email || "", userRole)) {
          if (chunk.type === "token" && chunk.content) {
            fullText += chunk.content;
            setMessages((prev) =>
              prev.map((m) => m.id === streamMsgId ? { ...m, text: fullText } : m)
            );
          } else if (chunk.type === "recommendations" && chunk.recommendations) {
            if (chunk.recommendations.length > 0) {
              setRecommendations(chunk.recommendations as Recommendation[]);
            }
          } else if (chunk.type === "error" && chunk.content) {
            fullText = chunk.content;
            setMessages((prev) =>
              prev.map((m) => m.id === streamMsgId ? { ...m, text: fullText, isStreaming: false } : m)
            );
          } else if (chunk.type === "done") {
            setMessages((prev) =>
              prev.map((m) => m.id === streamMsgId ? { ...m, isStreaming: false } : m)
            );
          }
        }

        // Finalize
        if (!fullText) {
          setMessages((prev) =>
            prev.map((m) => m.id === streamMsgId ? { ...m, text: "I'm having trouble connecting right now. Please try again.", isStreaming: false } : m)
          );
        } else {
          setMessages((prev) =>
            prev.map((m) => m.id === streamMsgId ? { ...m, isStreaming: false } : m)
          );
        }
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

  // ── Voice handling ──
  const handleVoiceAccept = useCallback(() => {
    const text = voice.acceptTranscript();
    if (text.trim()) {
      setInput(text);
    }
  }, [voice]);

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
          <div className="ml-auto flex items-center gap-3">
            {/* Session files indicator */}
            {sessionFiles.length > 0 && (
              <div className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5">
                <FileText className="h-3 w-3 text-primary" />
                <span className="text-[10px] font-medium text-primary">{sessionFiles.length} file{sessionFiles.length !== 1 ? "s" : ""} in context</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-medium text-emerald-500">Online</span>
            </div>
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
                  {msg.role === "ai" ? (
                    <>
                      {renderMarkdown(msg.text)}
                      {msg.isStreaming && (
                        <span className="inline-block w-1.5 h-4 ml-0.5 bg-primary/60 animate-pulse rounded-sm" />
                      )}
                    </>
                  ) : msg.text}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Typing indicator (shown only when not streaming) */}
          {isTyping && !messages.some(m => m.isStreaming) && (
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
          {/* Attached file preview — hidden during voice states */}
          {attachedFile && !voice.isRecording && !voice.isPreviewing && (
            <div className="mb-2 flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
              {getFileIcon(attachedFile.name)}
              <span className="flex-1 truncate text-xs text-foreground">{attachedFile.name}</span>
              <span className="text-[10px] text-muted-foreground">{formatFileSize(attachedFile.size)}</span>
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
                  if (f.size > 10 * 1024 * 1024) {
                    alert("File must be under 10 MB");
                  } else {
                    setAttachedFile(f);
                  }
                }
                e.target.value = "";
              }}
            />

            {/* Normal state: Attach + Mic buttons */}
            {!voice.isRecording && !voice.isPreviewing && (
              <>
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
                {(voice.isSupported || voice.isMediaSupported) && (
                  <motion.button
                    type="button"
                    onClick={() => voice.startRecording("auto")}
                    disabled={isTyping}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-secondary/40 text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors disabled:opacity-40"
                    aria-label="Start voice input"
                    whileHover={{ scale: 1.06 }}
                    whileTap={{ scale: 0.94 }}
                  >
                    <Mic className="h-4 w-4" />
                  </motion.button>
                )}
              </>
            )}

            {/* Recording state: compact inline waveform indicator */}
            {voice.isRecording && (
              <>
                <div className="flex-1 flex items-center gap-2.5 rounded-2xl border border-red-500/40 bg-red-500/5 px-3 py-2 min-w-0">
                  <div className="flex items-end gap-[2px] shrink-0" style={{ height: 16 }}>
                    {[0.4, 1, 0.6, 0.9, 0.5].map((_, i) => (
                      <motion.span
                        key={i}
                        animate={{ scaleY: [0.35, 1, 0.35] }}
                        transition={{ repeat: Infinity, duration: 0.55, delay: i * 0.1 }}
                        className="block w-[3px] rounded-full bg-red-500 origin-bottom h-full"
                      />
                    ))}
                  </div>
                  <span className="text-xs font-semibold text-red-500 shrink-0 tabular-nums">{voice.duration}s</span>
                  <span className="flex-1 text-xs text-muted-foreground truncate italic min-w-0">
                    {voice.transcript || "Listening…"}
                  </span>
                </div>
                <motion.button
                  type="button"
                  onClick={voice.stopRecording}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-red-500/50 bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                  whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
                  aria-label="Stop recording"
                >
                  <Square className="h-4 w-4" />
                </motion.button>
                <motion.button
                  type="button"
                  onClick={voice.cancelRecording}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-secondary/40 text-muted-foreground hover:text-foreground transition-colors"
                  whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
                  aria-label="Cancel recording"
                >
                  <X className="h-4 w-4" />
                </motion.button>
              </>
            )}

            {/* Preview state: inline editable transcript */}
            {voice.isPreviewing && (
              <>
                {voice.audioUrl && (
                  <>
                    <audio ref={audioPreviewRef} src={voice.audioUrl} className="hidden" />
                    <motion.button
                      type="button"
                      onClick={() => audioPreviewRef.current?.play()}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors"
                      whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
                      aria-label="Play recording"
                    >
                      <Play className="h-4 w-4" />
                    </motion.button>
                  </>
                )}
                <div className="flex-1 flex items-center rounded-2xl border border-primary/30 bg-primary/5 px-3 py-1 focus-within:border-primary/50 transition-colors min-w-0">
                  <input
                    value={voice.transcript}
                    onChange={(e) => voice.setTranscript(e.target.value)}
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none min-w-0 py-1.5"
                    placeholder="Edit transcript before sending…"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && voice.transcript.trim()) {
                        e.preventDefault();
                        handleVoiceAccept();
                      }
                    }}
                  />
                </div>
                <motion.button
                  type="button"
                  onClick={voice.cancelRecording}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-secondary/40 text-muted-foreground hover:text-foreground transition-colors"
                  whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
                  aria-label="Re-record"
                >
                  <RotateCcw className="h-4 w-4" />
                </motion.button>
                <motion.button
                  type="button"
                  onClick={handleVoiceAccept}
                  disabled={!voice.transcript.trim()}
                  className="flex h-10 shrink-0 items-center gap-1.5 rounded-2xl gradient-bg px-3 text-xs font-medium text-primary-foreground shadow-sm disabled:opacity-40 transition-opacity"
                  whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
                  aria-label="Use transcript"
                >
                  <Check className="h-3.5 w-3.5" /> Use
                </motion.button>
              </>
            )}

            {/* Normal state: text input + send */}
            {!voice.isRecording && !voice.isPreviewing && (
              <>
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
              </>
            )}
          </form>
          <p className="mt-1.5 text-center text-[10px] text-muted-foreground/50">
            Enter to send · 📎 Attach files · 🎤 Voice input (English/Urdu) · AI may make mistakes
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
