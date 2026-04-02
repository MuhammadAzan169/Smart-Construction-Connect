import { useCallback, useMemo } from "react";
import Particles from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";
import type { Engine, ISourceOptions } from "@tsparticles/engine";
import { useThemeStore } from "@/stores/themeStore";

export function ParticleBackground() {
  const theme = useThemeStore((s) => s.theme);

  const particlesInit = useCallback(async (engine: Engine) => {
    await loadSlim(engine);
  }, []);

  const options: ISourceOptions = useMemo(
    () => ({
      fullScreen: false,
      fpsLimit: 60,
      particles: {
        number: { value: 30, density: { enable: true } },
        color: {
          value: theme === "dark" ? "#F59E0B" : "#D97706",
        },
        opacity: {
          value: { min: 0.03, max: 0.1 },
          animation: { enable: true, speed: 0.3, sync: false },
        },
        size: {
          value: { min: 1, max: 3 },
        },
        move: {
          enable: true,
          speed: 0.4,
          direction: "none" as const,
          outModes: { default: "out" as const },
        },
        links: {
          enable: true,
          distance: 150,
          color: theme === "dark" ? "#F59E0B" : "#D97706",
          opacity: 0.04,
          width: 1,
        },
      },
      detectRetina: true,
    }),
    [theme],
  );

  return (
    <Particles
      id="bg-particles"
      className="pointer-events-none absolute inset-0 z-0"
      init={particlesInit}
      options={options}
    />
  );
}
