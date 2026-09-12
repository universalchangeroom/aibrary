import type { Metadata } from "next";

import { ContextTagCave } from "@/components/cave/ContextTagCave";

export const metadata: Metadata = {
  title: "The Context Tag Cave — ChatShare",
  description:
    "Discover the collective threads of AI wisdom through ChatShare's context tag cavern.",
};

export default function CavePage() {
  return <ContextTagCave />;
}
