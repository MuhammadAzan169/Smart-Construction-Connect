import * as React from "react";

import { cn } from "@/lib/utils";

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, interactive = true, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "glass-surface rounded-2xl",
        interactive && "transition-shadow card-shadow hover:card-shadow-hover",
        className,
      )}
      {...props}
    />
  ),
);
GlassCard.displayName = "GlassCard";
