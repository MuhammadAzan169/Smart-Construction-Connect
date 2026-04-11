import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";
import { useInView, useAnimatedCounter } from "@/hooks/useAnimations";
import { staggerContainer, staggerItem, sectionReveal } from "@/lib/animations";
import { cn } from "@/lib/utils";

/* ─── Section wrapper with scroll-triggered reveal ──────────── */
interface SectionRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}
export function SectionReveal({ children, className, delay = 0 }: SectionRevealProps) {
  const [ref, inView] = useInView(0.1);
  return (
    <motion.section
      ref={ref}
      variants={sectionReveal}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      transition={{ delay }}
      className={className}
    >
      {children}
    </motion.section>
  );
}

/* ─── Stagger container + items ─────────────────────────────── */
interface StaggerListProps {
  children: ReactNode;
  className?: string;
  stagger?: number;
  delay?: number;
}
export function StaggerList({ children, className, stagger = 0.08, delay = 0 }: StaggerListProps) {
  const [ref, inView] = useInView(0.1);
  return (
    <motion.div
      ref={ref}
      variants={staggerContainer(stagger, delay)}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={staggerItem} className={className}>
      {children}
    </motion.div>
  );
}

/* ─── Text typewriter reveal ────────────────────────────────── */
interface TypewriterProps {
  text: string;
  className?: string;
  speed?: number;
}
export function TypewriterText({ text, className, speed = 0.04 }: TypewriterProps) {
  return (
    <span className={className}>
      {text.split("").map((char, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: i * speed, duration: 0.1 }}
        >
          {char}
        </motion.span>
      ))}
    </span>
  );
}

/* ─── Animated counter display ──────────────────────────────── */
interface AnimatedCounterProps {
  value: number;
  suffix?: string;
  prefix?: string;
  className?: string;
}
export function AnimatedCounter({ value, suffix = "", prefix = "", className }: AnimatedCounterProps) {
  const { count, ref } = useAnimatedCounter(value);

  return (
    <span ref={ref} className={className}>
      {prefix}{count}{suffix}
    </span>
  );
}

/* ─── Reveal mask animation ─────────────────────────────────── */
export function RevealMask({ children, className }: { children: ReactNode; className?: string }) {
  const [ref, inView] = useInView(0.2);
  return (
    <motion.div
      ref={ref}
      initial={{ clipPath: "inset(0 100% 0 0)" }}
      animate={inView ? { clipPath: "inset(0 0% 0 0)" } : {}}
      transition={{ duration: 0.7, ease: [0.77, 0, 0.175, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─── Floating element ──────────────────────────────────────── */
export function FloatingElement({
  children,
  className,
  amplitude = 6,
  duration = 4,
}: {
  children: ReactNode;
  className?: string;
  amplitude?: number;
  duration?: number;
}) {
  return (
    <motion.div
      animate={{ y: [-amplitude, amplitude, -amplitude] }}
      transition={{ duration, repeat: Infinity, ease: "easeInOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─── Skeleton loader (premium) ─────────────────────────────── */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("skeleton-premium p-6 space-y-4", className)}>
      <div className="h-4 w-3/4 rounded-lg bg-muted-foreground/10" />
      <div className="h-3 w-1/2 rounded-lg bg-muted-foreground/10" />
      <div className="h-20 w-full rounded-xl bg-muted-foreground/10" />
      <div className="flex gap-3">
        <div className="h-8 w-24 rounded-lg bg-muted-foreground/10" />
        <div className="h-8 w-16 rounded-lg bg-muted-foreground/10" />
      </div>
    </div>
  );
}

/* ─── Confirmation Modal ────────────────────────────────────── */
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "destructive" | "default";
  onConfirm: () => void;
}

export function ConfirmModal({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
  onConfirm,
}: ConfirmModalProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="glass-surface-elevated border-border">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{cancelText}</AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirm}
              className={cn(
                variant === "destructive" && "bg-destructive text-destructive-foreground hover:bg-destructive/90",
              )}
            >
              {confirmText}
            </AlertDialogAction>
          </AlertDialogFooter>
        </motion.div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ─── Back button ───────────────────────────────────────────── */
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BackButton({ className }: { className?: string }) {
  const navigate = useNavigate();
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => navigate(-1)}
      className={cn("gap-1.5 text-muted-foreground hover:text-foreground", className)}
      aria-label="Go back to previous page"
    >
      <ArrowLeft className="h-4 w-4" />
      Back
    </Button>
  );
}
