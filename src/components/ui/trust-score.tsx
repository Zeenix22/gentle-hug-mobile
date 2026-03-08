import { cn } from "@/lib/utils";
import { Shield } from "lucide-react";
import type { AuthenticityLevel } from "@/types";

interface TrustScoreProps {
  score: number;
  level: AuthenticityLevel;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const levelColors: Record<AuthenticityLevel, string> = {
  authentic: "text-success",
  suspicious: "text-warning",
  manipulated: "text-destructive",
  uncertain: "text-secondary",
};

const levelRingColors: Record<AuthenticityLevel, string> = {
  authentic: "stroke-success",
  suspicious: "stroke-warning",
  manipulated: "stroke-destructive",
  uncertain: "stroke-secondary",
};

const levelBg: Record<AuthenticityLevel, string> = {
  authentic: "bg-success/10",
  suspicious: "bg-warning/10",
  manipulated: "bg-destructive/10",
  uncertain: "bg-secondary/10",
};

const sizes = {
  sm: { container: "h-20 w-20", radius: 32, stroke: 4, text: "text-lg", icon: "h-3 w-3", label: "text-[9px]" },
  md: { container: "h-28 w-28", radius: 46, stroke: 5, text: "text-2xl", icon: "h-4 w-4", label: "text-[10px]" },
  lg: { container: "h-36 w-36", radius: 58, stroke: 6, text: "text-3xl", icon: "h-5 w-5", label: "text-xs" },
};

const TrustScore = ({ score, level, size = "md", className }: TrustScoreProps) => {
  const sizeConfig = sizes[size];
  const circumference = 2 * Math.PI * sizeConfig.radius;
  const dashOffset = circumference - (score / 100) * circumference;
  const viewBox = (sizeConfig.radius + sizeConfig.stroke) * 2;

  return (
    <div className={cn("relative inline-flex flex-col items-center justify-center", sizeConfig.container, className)}>
      {/* Background ring */}
      <svg className="absolute inset-0 -rotate-90" viewBox={`0 0 ${viewBox} ${viewBox}`}>
        <circle
          cx={viewBox / 2}
          cy={viewBox / 2}
          r={sizeConfig.radius}
          fill="none"
          className="stroke-muted"
          strokeWidth={sizeConfig.stroke}
        />
        <circle
          cx={viewBox / 2}
          cy={viewBox / 2}
          r={sizeConfig.radius}
          fill="none"
          className={cn(levelRingColors[level], "transition-all duration-1000 ease-out")}
          strokeWidth={sizeConfig.stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>

      {/* Center content */}
      <div className={cn("relative z-10 flex flex-col items-center rounded-full p-2", levelBg[level])}>
        <span className={cn("font-extrabold leading-none", sizeConfig.text, levelColors[level])}>
          {score}
        </span>
        <span className={cn("font-medium text-muted-foreground mt-0.5", sizeConfig.label)}>
          / 100
        </span>
      </div>
    </div>
  );
};

export default TrustScore;
