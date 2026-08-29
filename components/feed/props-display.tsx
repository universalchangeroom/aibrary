import { Badge } from "@/components/ui/badge";
import { normalizePropsTotal, propsToEmojiString } from "@/lib/props-display";

interface PropsDisplayProps {
  total: unknown;
}

export function PropsDisplay({ total }: PropsDisplayProps) {
  const count = normalizePropsTotal(total);
  if (count === 0) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      aria-label={`${count} Props`}
    >
      <span
        className="text-lg leading-none tracking-[0.12em]"
        aria-hidden="true"
      >
        {propsToEmojiString(count)}
      </span>
      <Badge variant="secondary" className="text-xs font-medium">
        {count} Props
      </Badge>
    </div>
  );
}
