import * as React from "react";

import { cn } from "@/lib/utils";

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  glow?: boolean;
}

export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, interactive = true, glow = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "glass-surface rounded-2xl",
        interactive && "transition-all duration-300 card-shadow hover:card-shadow-hover hover:border-[rgb(255_255_255_/_0.12)]",
        glow && "glass-glow",
        className,
      )}
      {...props}
    />
  ),
);
GlassCard.displayName = "GlassCard";
