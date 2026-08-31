import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { normalizePropsTotal, propsToEmojiArray, propsToEmojiString } from "@/lib/props-display";

interface PropsDisplayProps {
  total: unknown;
  variant?: "default" | "card";
}

export function PropsDisplay({
  total,
  variant = "default",
}: PropsDisplayProps) {
  const count = normalizePropsTotal(total);

  if (count === 0 && variant === "default") return null;

  if (count === 0) {
    return (
      <p className="text-sm text-gray-400" aria-label="0 Props">
        0 Props
      </p>
    );
  }

  const isCard = variant === "card";
  const emojis = propsToEmojiArray(count);

  return (
    <div
      className={cn("flex flex-col gap-1", isCard && "gap-1.5")}
      aria-label={`${count} Props`}
    >
      <div
        className={cn(
          "flex flex-wrap items-center",
          isCard ? "gap-0.5 text-sm" : "gap-2"
        )}
      >
        {isCard ? (
          emojis.map((emoji, index) => (
            <span key={`${emoji}-${index}`} aria-hidden="true">
              {emoji}
            </span>
          ))
        ) : (
          <span
            className="text-lg leading-none tracking-[0.12em]"
            aria-hidden="true"
          >
            {propsToEmojiString(count)}
          </span>
        )}
        {!isCard ? (
          <Badge variant="secondary" className="text-xs font-medium">
            {count} Props
          </Badge>
        ) : null}
      </div>
      {isCard ? (
        <Badge
          variant="secondary"
          className="w-fit text-[10px] font-medium text-stone-500"
        >
          {count} Props
        </Badge>
      ) : null}
    </div>
  );
}
