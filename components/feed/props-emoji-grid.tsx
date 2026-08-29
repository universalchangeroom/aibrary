"use client";

import { cn } from "@/lib/utils";

interface PropsEmojiGridProps {
  availableProps: number;
  selectedAmount: number;
  onSelect: (amount: number) => void;
  disabled?: boolean;
}

const emojiButtonBase =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";

function EmojiButton({
  emoji,
  value,
  highlighted,
  onSelect,
  disabled,
  label,
}: {
  emoji: string;
  value: number;
  highlighted: boolean;
  onSelect: (amount: number) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        emojiButtonBase,
        highlighted
          ? "border-yellow-400 bg-yellow-200 opacity-100 dark:border-yellow-700 dark:bg-yellow-900/50"
          : "border-transparent bg-transparent opacity-50 hover:opacity-75"
      )}
      onClick={() => onSelect(value)}
      disabled={disabled}
      aria-label={label}
      aria-pressed={highlighted}
    >
      {emoji}
    </button>
  );
}

export function PropsEmojiGrid({
  availableProps,
  selectedAmount,
  onSelect,
  disabled = false,
}: PropsEmojiGridProps) {
  const fullRows = Math.floor(availableProps / 10);
  const remainder = availableProps % 10;

  return (
    <div
      className="flex flex-col gap-2"
      role="group"
      aria-label="Select Props amount"
    >
      {Array.from({ length: fullRows }, (_, rowIndex) => {
        const tensValue = (rowIndex + 1) * 10;
        const tensHighlighted = selectedAmount >= tensValue;

        return (
          <div
            key={`full-row-${rowIndex}`}
            className="flex flex-nowrap items-center gap-2"
          >
            <EmojiButton
              emoji="🥳"
              value={tensValue}
              highlighted={tensHighlighted}
              onSelect={onSelect}
              disabled={disabled}
              label={`${tensValue} Props`}
            />
            <div className="flex flex-nowrap items-center gap-1">
              {Array.from({ length: 10 }, (_, emojiIndex) => {
                const value = rowIndex * 10 + emojiIndex + 1;
                return (
                  <EmojiButton
                    key={`party-${rowIndex}-${emojiIndex}`}
                    emoji="🎉"
                    value={value}
                    highlighted={value <= selectedAmount}
                    onSelect={onSelect}
                    disabled={disabled}
                    label={`${value} Props`}
                  />
                );
              })}
            </div>
          </div>
        );
      })}

      {remainder > 0 ? (
        <div className="flex flex-nowrap items-center gap-2">
          <span
            className="inline-flex h-8 w-8 shrink-0"
            aria-hidden="true"
          />
          <div className="flex flex-nowrap items-center gap-1">
            {Array.from({ length: remainder }, (_, emojiIndex) => {
              const value = fullRows * 10 + emojiIndex + 1;
              return (
                <EmojiButton
                  key={`party-partial-${emojiIndex}`}
                  emoji="🎉"
                  value={value}
                  highlighted={value <= selectedAmount}
                  onSelect={onSelect}
                  disabled={disabled}
                  label={`${value} Props`}
                />
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
