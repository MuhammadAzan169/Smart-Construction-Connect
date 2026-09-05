import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronUp, ChevronDown, Minus, Plus } from "lucide-react";

interface NumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** "stepper" shows +/- side buttons; "arrows" shows compact up/down; default: "stepper" */
  variant?: "stepper" | "arrows" | "plain";
}

const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ className, variant = "stepper", onChange, min, max, step = 1, value, ...props }, ref) => {
    const numStep = Number(step) || 1;
    const numMin = min != null ? Number(min) : -Infinity;
    const numMax = max != null ? Number(max) : Infinity;

    const adjust = (dir: 1 | -1) => {
      const current = value != null && value !== "" ? Number(value) : 0;
      const next = Math.round((current + dir * numStep) * 1e6) / 1e6;
      const clamped = Math.min(numMax, Math.max(numMin, next));
      const synth = {
        target: { value: String(clamped) },
      } as React.ChangeEvent<HTMLInputElement>;
      onChange?.(synth);
    };

    if (variant === "plain") {
      return (
        <input
          ref={ref}
          type="number"
          value={value}
          onChange={onChange}
          min={min}
          max={max}
          step={step}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-border focus-visible:ring-1 focus-visible:ring-border/50 disabled:cursor-not-allowed disabled:opacity-50 transition-colors md:text-sm",
            className,
          )}
          {...props}
        />
      );
    }

    if (variant === "arrows") {
      return (
        <div className="relative flex items-center">
          <input
            ref={ref}
            type="number"
            value={value}
            onChange={onChange}
            min={min}
            max={max}
            step={step}
            className={cn(
              "flex h-10 w-full rounded-md border border-input bg-background pe-8 ps-3 py-2 text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-border focus-visible:ring-1 focus-visible:ring-border/50 disabled:cursor-not-allowed disabled:opacity-50 transition-colors md:text-sm",
              className,
            )}
            {...props}
          />
          <div className="absolute end-0 inset-y-0 flex flex-col border-s border-input">
            <button
              type="button"
              tabIndex={-1}
              onClick={() => adjust(1)}
              className="flex flex-1 items-center justify-center px-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors rounded-tr-md"
              aria-label="Increase"
            >
              <ChevronUp className="h-3 w-3" />
            </button>
            <div className="h-px bg-input" />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => adjust(-1)}
              className="flex flex-1 items-center justify-center px-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors rounded-br-md"
              aria-label="Decrease"
            >
              <ChevronDown className="h-3 w-3" />
            </button>
          </div>
        </div>
      );
    }

    // Default: "stepper" with +/- buttons on sides
    return (
      <div className="flex items-center gap-0">
        <button
          type="button"
          tabIndex={-1}
          onClick={() => adjust(-1)}
          className="flex h-10 w-9 shrink-0 items-center justify-center rounded-s-md border border-e-0 border-input bg-secondary/40 text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-colors disabled:opacity-40"
          disabled={props.disabled || (value != null && value !== "" && Number(value) <= numMin)}
          aria-label="Decrease"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <input
          ref={ref}
          type="number"
          value={value}
          onChange={onChange}
          min={min}
          max={max}
          step={step}
          className={cn(
            "flex h-10 w-full border-y border-input bg-background px-3 py-2 text-center text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-border focus-visible:ring-1 focus-visible:ring-border/50 disabled:cursor-not-allowed disabled:opacity-50 transition-colors md:text-sm",
            className,
          )}
          {...props}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => adjust(1)}
          className="flex h-10 w-9 shrink-0 items-center justify-center rounded-e-md border border-s-0 border-input bg-secondary/40 text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-colors disabled:opacity-40"
          disabled={props.disabled || (value != null && value !== "" && Number(value) >= numMax)}
          aria-label="Increase"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  },
);
NumberInput.displayName = "NumberInput";

export { NumberInput };
export type { NumberInputProps };
