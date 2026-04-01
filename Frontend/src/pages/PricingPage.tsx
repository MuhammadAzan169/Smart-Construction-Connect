import { GlassCard } from "@/components/shared/GlassCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

type Plan = {
  name: string;
  price: string;
  description: string;
  highlights?: string;
  features: string[];
  tone: "base" | "primary" | "premium";
  cta: string;
};

const plans: Plan[] = [
  {
    name: "Basic",
    price: "Free",
    description: "Explore companies and submit your first request.",
    features: ["Browse verified companies", "Request management", "Standard support"],
    tone: "base",
    cta: "Get started",
  },
  {
    name: "Pro",
    price: "PKR 4,999/mo",
    description: "For active projects and faster vendor matching.",
    features: ["Unlimited requests", "Priority matching", "AI assistant access"],
    tone: "primary",
    cta: "Choose Pro",
  },
  {
    name: "Premium",
    price: "PKR 12,999/mo",
    description: "Gold-tier control, visibility, and analytics.",
    highlights: "Premium",
    features: ["Premium supplier visibility", "Advanced analytics", "Priority support"],
    tone: "premium",
    cta: "Go Premium",
  },
];

function PlanCard({ plan }: { plan: Plan }) {
  const premium = plan.tone === "premium";

  return (
    <GlassCard
      className={cn(
        "p-6",
        premium && "ring-1 ring-premium/30 bg-premium/5"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{plan.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">{plan.description}</p>
        </div>
        {plan.highlights ? (
          <Badge
            variant={premium ? "outline" : "secondary"}
            className={cn(
              "rounded-lg",
              premium && "border-premium/30 text-premium"
            )}
          >
            {plan.highlights}
          </Badge>
        ) : null}
      </div>

      <div className="mt-5">
        <p className="text-3xl font-bold text-foreground">{plan.price}</p>
        <p className="mt-1 text-xs text-muted-foreground">Billed monthly. Cancel anytime.</p>
      </div>

      <div className="mt-5 space-y-2">
        {plan.features.map((f) => (
          <div key={f} className="flex items-start gap-2 text-sm">
            <div className={cn("mt-0.5 rounded-md p-1", premium ? "bg-premium/10" : "bg-primary/10")}>
              <Check className={cn("h-3.5 w-3.5", premium ? "text-premium" : "text-primary")} />
            </div>
            <span className="text-foreground">{f}</span>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <Button
          className={cn(
            "w-full",
            premium && "bg-premium text-premium-foreground hover:bg-premium/90"
          )}
          variant={plan.tone === "base" ? "secondary" : "default"}
        >
          {plan.cta}
        </Button>
      </div>
    </GlassCard>
  );
}

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Pricing</h1>
        <p className="text-sm text-muted-foreground">Three tiers designed for real construction workflows.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((p) => (
          <PlanCard key={p.name} plan={p} />
        ))}
      </div>
    </div>
  );
}
