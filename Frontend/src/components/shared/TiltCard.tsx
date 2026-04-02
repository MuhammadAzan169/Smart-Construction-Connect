import Tilt from "react-parallax-tilt";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface TiltCardProps {
  children: ReactNode;
  className?: string;
  glare?: boolean;
  tiltMaxAngleX?: number;
  tiltMaxAngleY?: number;
  scale?: number;
}

export function TiltCard({
  children,
  className,
  glare = true,
  tiltMaxAngleX = 8,
  tiltMaxAngleY = 8,
  scale = 1.02,
}: TiltCardProps) {
  return (
    <Tilt
      tiltMaxAngleX={tiltMaxAngleX}
      tiltMaxAngleY={tiltMaxAngleY}
      scale={scale}
      transitionSpeed={300}
      glareEnable={glare}
      glareMaxOpacity={0.08}
      glareColor="rgb(245, 158, 11)"
      glarePosition="all"
      glareBorderRadius="1rem"
      className={cn("rounded-2xl", className)}
    >
      {children}
    </Tilt>
  );
}
