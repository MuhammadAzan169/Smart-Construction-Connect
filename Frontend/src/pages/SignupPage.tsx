import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore, UserRole } from "@/stores/authStore";
import { motion } from "framer-motion";
import { HardHat, Eye, EyeOff } from "lucide-react";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("client");
  const [showPw, setShowPw] = useState(false);
  const signup = useAuthStore((s) => s.signup);
  const navigate = useNavigate();

  const roles: { value: UserRole; label: string; emoji: string; desc: string }[] = [
    { value: "client", label: "Client", emoji: "👤", desc: "Find & hire builders" },
    { value: "company", label: "Company", emoji: "🏢", desc: "Get project leads" },
    { value: "supplier", label: "Supplier", emoji: "🧱", desc: "Sell materials" },
    { value: "admin", label: "Admin", emoji: "🛠", desc: "Platform management" },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    signup(name, email, password, role);
    navigate("/dashboard");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl gradient-bg">
            <HardHat className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Create an account</h1>
          <p className="mt-1 text-sm text-muted-foreground">Join Smart Construction Connect</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-8 card-shadow">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Role selector */}
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">I am a...</label>
              <div className="grid grid-cols-2 gap-2">
                {roles.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRole(r.value)}
                    className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all ${
                      role === r.value
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/30"
                    }`}
                  >
                    <span className="text-lg">{r.emoji}</span>
                    <span className={`mt-1 text-sm font-medium ${role === r.value ? "text-primary" : "text-foreground"}`}>{r.label}</span>
                    <span className="text-xs text-muted-foreground">{r.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                required
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {(role === "company" || role === "supplier") && (
              <div className="rounded-lg bg-warning/10 p-3 text-xs text-warning">
                ⚡ {role === "company" ? "Company" : "Supplier"} accounts require admin approval before access.
              </div>
            )}

            <button
              type="submit"
              className="h-10 w-full rounded-lg gradient-bg text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Create Account
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
