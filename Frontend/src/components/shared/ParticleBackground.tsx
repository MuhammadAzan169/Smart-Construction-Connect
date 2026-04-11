/**
 * Lightweight CSS-only particle dots replacing the heavy tsparticles library (~50KB saved).
 * Uses CSS animations that automatically respect prefers-reduced-motion.
 */
export function ParticleBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
      {Array.from({ length: 18 }).map((_, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-primary/[0.08] animate-particle-float"
          style={{
            width: `${2 + (i % 3) * 1.5}px`,
            height: `${2 + (i % 3) * 1.5}px`,
            left: `${(i * 5.5 + 3) % 100}%`,
            top: `${(i * 7.3 + 5) % 100}%`,
            animationDelay: `${i * 0.8}s`,
            animationDuration: `${12 + (i % 5) * 4}s`,
          }}
        />
      ))}
    </div>
  );
}
