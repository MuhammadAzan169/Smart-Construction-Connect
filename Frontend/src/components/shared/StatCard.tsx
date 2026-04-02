import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { useAnimatedCounter } from "@/hooks/useAnimations";

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  icon: LucideIcon;
  trend?: "up" | "down";
}

function StatValue({ value }: { value: string | number }) {
  const num = typeof value === "number" ? value : parseInt(value, 10);
  const isNum = !isNaN(num) && typeof value === "number";
  const suffix = typeof value === "string" ? value.replace(/[\d,]/g, "") : "";
  const { count, ref } = useAnimatedCounter(isNum ? num : 0);

  if (!isNum) return <span>{value}</span>;
  return <span ref={ref}>{count}{suffix}</span>;
}

export function StatCard({ title, value, change, icon: Icon, trend }: StatCardProps) {
  return (
    <motion.div
      whileHover={{ y: -3, transition: { type: "spring", stiffness: 300, damping: 24 } }}
      className="glass-surface rounded-2xl p-6 transition-all duration-300 card-shadow hover:card-shadow-hover hover:border-[rgb(255_255_255_/_0.14)] group"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-bold text-foreground">
            <StatValue value={value} />
          </p>
          {change && (
            <p className={`mt-1 text-sm font-medium ${trend === "up" ? "text-success" : "text-destructive"}`}>
              {change}
            </p>
          )}
        </div>
        <motion.div
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/20"
          whileHover={{ rotate: 8 }}
        >
          <Icon className="h-5 w-5 text-primary" />
        </motion.div>
      </div>
    </motion.div>
  );
}
