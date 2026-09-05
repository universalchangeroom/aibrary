"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PropsExplainerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CEILINGS = [
  { days: "Sunday–Monday", max: "100" },
  { days: "Tuesday–Wednesday", max: "80" },
  { days: "Thursday–Saturday", max: "60" },
] as const;

const CORE_RULES = [
  {
    title: "The 100-Prop Limit",
    body: "Give generously, but fairly. You can award up to 100 Props to any single chat.",
  },
  {
    title: "The Burn Rule",
    body: "Props are a commitment. Retracting an endorsement permanently burns the Props without a refund.",
  },
  {
    title: "Fair Play",
    body: "You cannot give Props to your own published chats.",
  },
] as const;

export function PropsExplainerModal({
  isOpen,
  onClose,
}: PropsExplainerModalProps) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[min(90vh,42rem)] max-w-lg overflow-y-auto border-orange-200/80 bg-gradient-to-br from-orange-50 via-amber-50 to-rose-50 text-stone-800 shadow-xl sm:rounded-xl">
        <DialogHeader className="space-y-3 text-left">
          <DialogTitle className="text-2xl font-bold tracking-tight text-stone-900">
            How Props Work
          </DialogTitle>
          <DialogDescription className="text-base leading-relaxed text-stone-600">
            On ChatShare, we don&apos;t do comments. When you discover a
            brilliant prompt or a fascinating AI deep-dive, you show your
            appreciation with Props.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-center gap-3 py-1">
          <span className="inline-flex items-center gap-2 rounded-xl border border-orange-200 bg-white/90 px-4 py-3 text-base font-semibold text-stone-800 shadow-sm">
            <span className="text-2xl leading-none" aria-hidden>
              🎉
            </span>
            <span>= 1 Prop</span>
          </span>
          <span className="inline-flex items-center gap-2 rounded-xl border border-orange-200 bg-white/90 px-4 py-3 text-base font-semibold text-stone-800 shadow-sm">
            <span className="text-2xl leading-none" aria-hidden>
              🥳
            </span>
            <span>= 10 Props</span>
          </span>
        </div>

        <section className="space-y-3 rounded-lg border border-orange-200/70 bg-white/70 px-4 py-3 shadow-sm">
          <h3 className="text-sm font-semibold text-stone-900">
            How Your Props Refresh
          </h3>
          <p className="text-sm leading-relaxed text-stone-600">
            <span className="font-medium text-stone-800">Sunday reset:</span>{" "}
            Every Sunday your balance renews to{" "}
            <span className="font-medium text-stone-800">100 Props</span>—your
            full weekly start.
          </p>

          <div className="overflow-hidden rounded-md border border-orange-200/80 bg-white/90">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Weekday Props holding ceilings</caption>
              <thead className="bg-orange-50/90 text-stone-700">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Days
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Max you can hold
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-orange-100 text-stone-700">
                {CEILINGS.map((row) => (
                  <tr key={row.days}>
                    <td className="px-3 py-2">{row.days}</td>
                    <td className="px-3 py-2 tabular-nums font-medium text-stone-900">
                      {row.max}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-sm leading-relaxed text-stone-600">
            If you&apos;re over a day&apos;s ceiling, your available balance is
            trimmed down to it. You are not topped back up mid-week—Sunday is
            the only refill.
          </p>
          <p className="text-xs leading-relaxed text-stone-500">
            This weekly holding budget is separate from the 100-Prop Influence
            Cap on any single chat.
          </p>
        </section>

        <ul className="space-y-3">
          {CORE_RULES.map((rule) => (
            <li
              key={rule.title}
              className="rounded-lg border border-orange-200/70 bg-white/70 px-4 py-3 shadow-sm"
            >
              <p className="text-sm font-semibold text-stone-900">{rule.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-stone-600">
                {rule.body}
              </p>
            </li>
          ))}
        </ul>

        <DialogFooter className="sm:justify-center">
          <Button
            type="button"
            onClick={onClose}
            className="w-full bg-orange-600 text-white hover:bg-orange-700 sm:w-auto"
          >
            Got it!
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
