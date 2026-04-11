/**
 * Subtle animated gradient blobs in the background.
 * Uses CSS animations instead of JS-driven Framer Motion for ~180k fewer paint events.
 * Respects prefers-reduced-motion automatically via CSS.
 */
export function AnimatedBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div
        className="absolute -left-[20%] -top-[10%] h-[600px] w-[600px] rounded-full bg-primary/[0.06] blur-[120px] animate-blob-slow"
      />
      <div
        className="absolute -right-[15%] top-[30%] h-[500px] w-[500px] rounded-full bg-highlight/[0.05] blur-[120px] animate-blob-slow-reverse"
      />
      <div
        className="absolute bottom-[-10%] start-[40%] h-[400px] w-[400px] rounded-full bg-premium/[0.04] blur-[100px] animate-blob-medium"
      />
    </div>
  );
}
