"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { ChevronDown, ChevronsUpDown, Plus, Trash2 } from "lucide-react";

import { MarkdownRenderer } from "@/components/markdown-renderer";
import { RichTextEditor } from "@/components/rich-text-editor";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ChatMessage, FootnoteWithVotes } from "@/lib/types";

export type ConversationExpandState = {
  canExpand: boolean;
  allExpanded: boolean;
};

export type ConversationViewHandle = {
  toggleExpandAll: () => void;
};

interface ConversationViewProps {
  messages: ChatMessage[];
  footnotes?: FootnoteWithVotes[];
  threadId: string;
  isEditing?: boolean;
  onMessageContentChange?: (index: number, content: string) => void;
  onRemoveMessage?: (index: number) => void;
  onAddMessage?: () => void;
  /** When true, Expand/Collapse All is not rendered inside the conversation. */
  hideExpandControls?: boolean;
  onExpandStateChange?: (state: ConversationExpandState) => void;
  /** `glass` = dark expanded-card reading surface. */
  tone?: "default" | "glass";
}

type ViewTurn =
  | {
      kind: "pair";
      user: ChatMessage;
      userIndex: number;
      assistant: ChatMessage | null;
      assistantIndex: number | null;
    }
  | {
      kind: "orphan";
      message: ChatMessage;
      index: number;
    };

function RoleBadge({
  isUser,
  tone,
}: {
  isUser: boolean;
  tone: "default" | "glass";
}) {
  if (tone === "glass") {
    return (
      <span
        className={cn(
          "rounded-md px-2 py-0.5 text-xs font-semibold tracking-wide",
          isUser
            ? "bg-amber-400/15 text-amber-100"
            : "bg-cyan-400/15 text-cyan-100"
        )}
      >
        {isUser ? "USER" : "AI"}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "rounded-md px-2 py-0.5 text-xs font-semibold",
        isUser
          ? "bg-secondary text-secondary-foreground"
          : "bg-primary text-primary-foreground"
      )}
    >
      {isUser ? "USER" : "AI"}
    </span>
  );
}

function messageShellClass(isUser: boolean, tone: "default" | "glass") {
  if (tone === "glass") {
    return cn(
      "w-full rounded-xl border p-4 sm:p-5",
      isUser
        ? "border-white/10 bg-white/5 text-stone-100"
        : "border-transparent bg-transparent text-stone-200"
    );
  }

  return cn(
    "w-full rounded-xl border p-4 sm:p-5",
    isUser
      ? "border-border bg-muted/50 text-foreground"
      : "border-border bg-card text-card-foreground"
  );
}

/** Pair each user prompt with the following AI reply for collapsible view mode. */
function buildViewTurns(messages: ChatMessage[]): ViewTurn[] {
  const turns: ViewTurn[] = [];
  let i = 0;

  while (i < messages.length) {
    const message = messages[i];
    if (message.role === "user") {
      const next = messages[i + 1];
      const hasAssistant = next?.role === "assistant";
      turns.push({
        kind: "pair",
        user: message,
        userIndex: i,
        assistant: hasAssistant ? next : null,
        assistantIndex: hasAssistant ? i + 1 : null,
      });
      i += hasAssistant ? 2 : 1;
      continue;
    }

    turns.push({ kind: "orphan", message, index: i });
    i += 1;
  }

  return turns;
}

function MessageBody({
  message,
  isUser,
  index,
  isEditing,
  onMessageContentChange,
  onRemoveMessage,
  chevron,
  tone = "default",
}: {
  message: ChatMessage;
  isUser: boolean;
  index: number;
  isEditing: boolean;
  onMessageContentChange?: (index: number, content: string) => void;
  onRemoveMessage?: (index: number) => void;
  chevron?: boolean;
  tone?: "default" | "glass";
}) {
  return (
    <article className={messageShellClass(isUser, tone)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <RoleBadge isUser={isUser} tone={tone} />
        {chevron ? (
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 transition-transform duration-200 group-open:rotate-180",
              tone === "glass" ? "text-white/50" : "text-muted-foreground"
            )}
            aria-hidden
          />
        ) : null}
        {isEditing && onRemoveMessage ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 w-8 shrink-0 p-0 hover:text-destructive",
              tone === "glass"
                ? "text-white/50 hover:bg-white/10"
                : "text-muted-foreground"
            )}
            onClick={() => onRemoveMessage(index)}
            aria-label={`Delete ${isUser ? "user" : "AI"} message`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      {isEditing && onMessageContentChange ? (
        <RichTextEditor
          content={message.content}
          onChange={(markdown) => onMessageContentChange(index, markdown)}
          placeholder={isUser ? "User message…" : "Assistant / AI response…"}
          className={
            tone === "glass" ? "bg-black/30 text-stone-100" : "bg-background"
          }
          editorClassName="min-h-[120px]"
        />
      ) : (
        <MarkdownRenderer
          content={message.content}
          className={
            tone === "glass"
              ? "prose-invert prose-headings:text-amber-50 prose-p:text-stone-200 prose-strong:text-white prose-a:text-cyan-300"
              : undefined
          }
        />
      )}
    </article>
  );
}

function initialOpenTurnIds(
  messages: ChatMessage[],
  isEditing: boolean
): Set<number> {
  if (isEditing) return new Set();
  const list = messages.filter((message) => message.role !== "system");
  return new Set(
    buildViewTurns(list)
      .filter(
        (turn): turn is Extract<ViewTurn, { kind: "pair" }> =>
          turn.kind === "pair"
      )
      .map((turn) => turn.userIndex)
  );
}

export const ConversationView = forwardRef<
  ConversationViewHandle,
  ConversationViewProps
>(function ConversationView(
  {
    messages = [],
    isEditing = false,
    onMessageContentChange,
    onRemoveMessage,
    onAddMessage,
    hideExpandControls = false,
    onExpandStateChange,
    tone = "default",
  },
  ref
) {
  const list = isEditing
    ? messages
    : messages.filter((message) => message.role !== "system");

  const viewTurns = !isEditing ? buildViewTurns(list) : [];
  const pairTurnIds = viewTurns
    .filter(
      (turn): turn is Extract<ViewTurn, { kind: "pair" }> =>
        turn.kind === "pair"
    )
    .map((turn) => turn.userIndex);

  // Default: every User/AI pair starts expanded (`open` on each <details>).
  const [openTurnIds, setOpenTurnIds] = useState<Set<number>>(() =>
    initialOpenTurnIds(messages, isEditing)
  );

  const canExpand = !isEditing && pairTurnIds.length > 0;
  const allExpanded =
    canExpand && pairTurnIds.every((id) => openTurnIds.has(id));

  function toggleExpandAll() {
    if (!canExpand) return;
    setOpenTurnIds(allExpanded ? new Set() : new Set(pairTurnIds));
  }

  useImperativeHandle(
    ref,
    () => ({
      toggleExpandAll,
    }),
    // toggleExpandAll closes over current expand state / pair ids
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allExpanded, canExpand, pairTurnIds.join("|")]
  );

  useEffect(() => {
    onExpandStateChange?.({ canExpand, allExpanded });
  }, [canExpand, allExpanded, onExpandStateChange]);

  function handleTurnToggle(userIndex: number, isOpen: boolean) {
    setOpenTurnIds((prev) => {
      const alreadyOpen = prev.has(userIndex);
      if (isOpen === alreadyOpen) return prev;
      const next = new Set(prev);
      if (isOpen) next.add(userIndex);
      else next.delete(userIndex);
      return next;
    });
  }

  return (
    <section className="flex w-full flex-col gap-5" aria-label="Conversation">
      {list.length === 0 ? (
        <p
          className={cn(
            "rounded-xl border border-dashed px-4 py-8 text-center text-sm",
            tone === "glass"
              ? "border-white/15 text-white/55"
              : "text-muted-foreground"
          )}
        >
          No transcript was saved for this thread.
        </p>
      ) : null}

      {!hideExpandControls && canExpand ? (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={
              tone === "glass"
                ? "border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                : undefined
            }
            onClick={toggleExpandAll}
            aria-pressed={allExpanded}
          >
            <ChevronsUpDown className="h-4 w-4" />
            {allExpanded ? "Collapse All" : "Expand All"}
          </Button>
        </div>
      ) : null}

      {isEditing
        ? list.map((message, index) => {
            const isUser = message.role === "user";
            return (
              <MessageBody
                key={`${message.role}-${index}`}
                message={message}
                isUser={isUser}
                index={index}
                isEditing
                tone={tone}
                onMessageContentChange={onMessageContentChange}
                onRemoveMessage={onRemoveMessage}
              />
            );
          })
        : viewTurns.map((turn) => {
            if (turn.kind === "orphan") {
              return (
                <MessageBody
                  key={`orphan-${turn.message.role}-${turn.index}`}
                  message={turn.message}
                  isUser={turn.message.role === "user"}
                  index={turn.index}
                  isEditing={false}
                  tone={tone}
                />
              );
            }

            return (
              <details
                key={`turn-${turn.userIndex}`}
                className="group flex w-full flex-col gap-5"
                open={openTurnIds.has(turn.userIndex)}
                onToggle={(event) => {
                  handleTurnToggle(turn.userIndex, event.currentTarget.open);
                }}
              >
                <summary
                  className={cn(
                    "cursor-pointer list-none [&::-webkit-details-marker]:hidden",
                    "rounded-xl outline-none focus-visible:ring-2",
                    tone === "glass"
                      ? "focus-visible:ring-cyan-400/50"
                      : "focus-visible:ring-ring"
                  )}
                >
                  <MessageBody
                    message={turn.user}
                    isUser
                    index={turn.userIndex}
                    isEditing={false}
                    tone={tone}
                    chevron
                  />
                </summary>

                {turn.assistant ? (
                  <MessageBody
                    message={turn.assistant}
                    isUser={false}
                    index={turn.assistantIndex ?? turn.userIndex + 1}
                    isEditing={false}
                    tone={tone}
                  />
                ) : (
                  <p
                    className={cn(
                      "w-full rounded-xl border border-dashed px-4 py-3 text-sm",
                      tone === "glass"
                        ? "border-white/15 text-white/50"
                        : "text-muted-foreground"
                    )}
                  >
                    No AI response for this prompt.
                  </p>
                )}
              </details>
            );
          })}

      {isEditing && onAddMessage ? (
        <div className="flex justify-center pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAddMessage}
            className={cn(
              "gap-1.5",
              tone === "glass" &&
                "border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            )}
          >
            <Plus className="h-4 w-4" />
            Add Message
          </Button>
        </div>
      ) : null}
    </section>
  );
});
