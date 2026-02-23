import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface DayOption {
  key: string;
  label: string;
  date: string;
}

interface DayToggleProps {
  options: DayOption[];
  activeKey: string;
  onChange: (key: string) => void;
}

export function DayToggle({ options, activeKey, onChange }: DayToggleProps) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {options.map((option) => (
        <Button
          key={option.key}
          variant="outline"
          className={cn(activeKey === option.key && "border-primary bg-primary/20 text-primary")}
          onClick={() => onChange(option.key)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
