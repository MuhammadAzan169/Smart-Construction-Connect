import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/shared/GlassCard";
import { AnimatedBackground } from "@/components/shared/AnimatedBackground";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 overflow-hidden">
      <AnimatedBackground />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10"
      >
      <GlassCard interactive={false} className="w-full max-w-md p-8 text-center">
        <motion.h1
          className="text-6xl font-extrabold text-foreground"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          404
        </motion.h1>
        <motion.p
          className="mt-3 text-sm text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.4 }}
        >
          This route doesn't exist in Smart Construction Connect.
        </motion.p>
        <motion.div
          className="mt-6 flex justify-center gap-3"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
        >
          <Button asChild>
            <Link to="/">Return home</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/login">Sign in</Link>
          </Button>
        </motion.div>
      </GlassCard>
      </motion.div>
    </div>
  );
};

export default NotFound;
