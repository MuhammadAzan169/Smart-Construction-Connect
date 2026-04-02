/**
 * Centralized animation variants & utilities for Framer Motion.
 * All durations are fast (0.2–0.5s) and GPU-friendly.
 */
import type { Variants, Transition } from "framer-motion";

/* ─── Base Transitions ──────────────────────────────────────── */
export const springSnappy: Transition = { type: "spring", stiffness: 300, damping: 24 };
export const springGentle: Transition = { type: "spring", stiffness: 200, damping: 20 };
export const easeOut: Transition = { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] };
export const easeFast: Transition = { duration: 0.22, ease: "easeOut" };

/* ─── Fade + Slide Variants ─────────────────────────────────── */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: easeOut },
};

export const fadeDown: Variants = {
  hidden: { opacity: 0, y: -16 },
  visible: { opacity: 1, y: 0, transition: easeOut },
};

export const fadeLeft: Variants = {
  hidden: { opacity: 0, x: -24 },
  visible: { opacity: 1, x: 0, transition: easeOut },
};

export const fadeRight: Variants = {
  hidden: { opacity: 0, x: 24 },
  visible: { opacity: 1, x: 0, transition: easeOut },
};

export const fadeScale: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: { opacity: 1, scale: 1, transition: easeOut },
};

/* ─── Stagger Container ─────────────────────────────────────── */
export const staggerContainer = (stagger = 0.08, delay = 0): Variants => ({
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: stagger,
      delayChildren: delay,
    },
  },
});

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: easeOut },
};

export const staggerItemScale: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1, transition: easeOut },
};

/* ─── Page Transitions ──────────────────────────────────────── */
export const pageTransition: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2, ease: "easeIn" } },
};

/* ─── Section Reveal ────────────────────────────────────────── */
export const sectionReveal: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

/* ─── Reveal Mask (Slide Mask) ──────────────────────────────── */
export const revealMask: Variants = {
  hidden: { clipPath: "inset(0 100% 0 0)" },
  visible: {
    clipPath: "inset(0 0% 0 0)",
    transition: { duration: 0.6, ease: [0.77, 0, 0.175, 1] },
  },
};

/* ─── Floating Animation ────────────────────────────────────── */
export const float = (amplitude = 6, duration = 4): Variants => ({
  animate: {
    y: [-amplitude, amplitude, -amplitude],
    transition: {
      duration,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
});

/* ─── Hover Effects ─────────────────────────────────────────── */
export const hoverLift = {
  whileHover: { y: -6, transition: springSnappy },
  whileTap: { scale: 0.98 },
};

export const hoverScale = {
  whileHover: { scale: 1.03, transition: springSnappy },
  whileTap: { scale: 0.97 },
};

export const hoverGlow = {
  whileHover: {
    boxShadow: "0 0 30px rgba(245,158,11,0.15), 0 0 60px rgba(245,158,11,0.08)",
    transition: easeFast,
  },
};

/* ─── Counter Animation (for stat numbers) ──────────────────── */
export const counterTransition: Transition = {
  duration: 1.5,
  ease: [0.25, 0.46, 0.45, 0.94],
};

/* ─── Scroll-linked helpers ─────────────────────────────────── */
export const scrollFadeScale: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5 } },
};

/* ─── Layout transition preset ──────────────────────────────── */
export const layoutTransition: Transition = {
  type: "spring",
  stiffness: 250,
  damping: 25,
};
