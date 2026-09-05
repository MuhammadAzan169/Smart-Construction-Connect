import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  glow?: boolean;
  hoverLift?: boolean;
}

export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, interactive = true, glow = false, hoverLift = false, children, ...props }, ref) => {
    const Wrapper = interactive && hoverLift ? motion.div : "div";
    const motionProps = interactive && hoverLift ? {
      whileHover: { y: -4, transition: { type: "spring", stiffness: 300, damping: 24 } },
      whileTap: { scale: 0.99 },
    } : {};

    return (
      <Wrapper
        ref={ref}
        className={cn(
          "glass-surface rounded-2xl",
          interactive && "transition-all duration-300 card-shadow hover:card-shadow-hover hover:border-[rgb(255_255_255_/_0.14)]",
          glow && "glass-glow animate-glow-pulse",
          className,
        )}
        {...motionProps}
        {...props}
      >
        {children}
      </Wrapper>
    );
  },
);
GlassCard.displayName = "GlassCard";
