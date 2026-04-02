import { motion } from "framer-motion";

/**
 * Subtle animated gradient blobs in the background.
 * Use as a section background enhancement — very light, non-distracting.
 */
export function AnimatedBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        className="absolute -left-[20%] -top-[10%] h-[600px] w-[600px] rounded-full bg-primary/[0.06] blur-[120px]"
        animate={{
          x: [0, 30, -20, 0],
          y: [0, -20, 15, 0],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="absolute -right-[15%] top-[30%] h-[500px] w-[500px] rounded-full bg-highlight/[0.05] blur-[120px]"
        animate={{
          x: [0, -25, 20, 0],
          y: [0, 25, -15, 0],
        }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="absolute bottom-[-10%] left-[40%] h-[400px] w-[400px] rounded-full bg-premium/[0.04] blur-[100px]"
        animate={{
          x: [0, 20, -15, 0],
          y: [0, -15, 20, 0],
        }}
        transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
}
