import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { GlassCard } from "@/components/shared/GlassCard";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <GlassCard interactive={false} className="w-full max-w-md p-8 text-center">
        <h1 className="text-5xl font-extrabold text-foreground">404</h1>
        <p className="mt-3 text-sm text-muted-foreground">This route doesn’t exist in Smart Construction Connect.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button asChild>
            <Link to="/">Return home</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/login">Sign in</Link>
          </Button>
        </div>
      </GlassCard>
    </div>
  );
};

export default NotFound;
