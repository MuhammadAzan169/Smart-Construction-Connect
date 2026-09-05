import { cn } from "@/lib/utils";
import { useRef, useCallback, type ReactNode } from "react";

interface TiltCardProps {
  children: ReactNode;
  className?: string;
  glare?: boolean;
  tiltMaxAngleX?: number;
  tiltMaxAngleY?: number;
  scale?: number;
}

/**
 * Lightweight CSS-only tilt effect replacing react-parallax-tilt (~15KB saved).
 * Uses CSS transform3d on mousemove; automatically disabled for keyboard users
 * and prefers-reduced-motion.
 */
export function TiltCard({
  children,
  className,
  tiltMaxAngleX = 8,
  tiltMaxAngleY = 8,
  scale = 1.02,
}: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      el.style.transform = `perspective(600px) rotateY(${x * tiltMaxAngleX}deg) rotateX(${-y * tiltMaxAngleY}deg) scale3d(${scale}, ${scale}, 1)`;
    },
    [tiltMaxAngleX, tiltMaxAngleY, scale],
  );

  const handleMouseLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "";
  }, []);

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn("rounded-2xl transition-transform duration-300 ease-out will-change-transform motion-reduce:!transform-none", className)}
      style={{ transformStyle: "preserve-3d" }}
    >
      {children}
    </div>
  );
}
