import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface FileTypeBadgeProps {
  icon: LucideIcon;
  label: string;
  formats: string;
  className?: string;
}

const FileTypeBadge = ({ icon: Icon, label, formats, className }: FileTypeBadgeProps) => {
  return (
    <div
      className={cn(
        "group rounded-xl bg-card border border-border p-4 text-center transition-all duration-200 hover:border-primary/30 hover:shadow-sm hover:scale-[1.02]",
        className
      )}
    >
      <div className="rounded-lg bg-primary/10 p-2 inline-flex mb-2 group-hover:bg-primary/15 transition-colors">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <p className="text-xs font-semibold text-foreground">{label}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{formats}</p>
    </div>
  );
};

export default FileTypeBadge;
