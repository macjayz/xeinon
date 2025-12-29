import { Sparkles } from "lucide-react";

interface GraduatedBadgeProps {
  className?: string;
}

export const GraduatedBadge = ({ className = "" }: GraduatedBadgeProps) => {
  return (
    <span 
      className={`
        inline-flex items-center gap-1
        bg-gradient-to-r from-primary to-accent 
        text-primary-foreground 
        rounded-full
        px-1.5 py-0.5
        text-[10px] font-medium
        shadow-sm
        whitespace-nowrap
        ${className}
      `}
    >
      <Sparkles className="h-2.5 w-2.5" />
      New
    </span>
  );
};
