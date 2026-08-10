import Link from "next/link";
import { Link2, MessagesSquare, ShieldCheck } from "lucide-react";

import { ImportModal } from "@/components/landing/import-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Feature {
  icon: React.ElementType;
  title: string;
  description: string;
}

const features: Feature[] = [
  {
    icon: Link2,
    title: "One-click sharing",
    description:
      "Turn any conversation into a clean, readable page with a single shareable link.",
  },
  {
    icon: MessagesSquare,
    title: "Organized library",
    description:
      "Keep every chat in one place — searchable, taggable, and easy to revisit.",
  },
  {
    icon: ShieldCheck,
    title: "Privacy first",
    description:
      "You decide what goes public. Everything else stays private by default.",
  },
];

export function Hero() {
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col items-center px-6 py-24 text-center">
      <Badge variant="secondary" className="mb-6">
        Now in early access
      </Badge>

      <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
        Share your AI conversations,{" "}
        <span className="text-primary">beautifully</span>
      </h1>

      <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
        ChatShare turns your AI chats into polished, shareable pages. Save the
        conversations that matter, organize them into collections, and share
        insights with your team or the world — all with one link.
      </p>

      <div className="mt-10 flex flex-col gap-4 sm:flex-row">
        <ImportModal triggerLabel="Get started free" />
        <Button size="lg" variant="outline" asChild>
          <Link href="/feed">See an example</Link>
        </Button>
      </div>

      <div className="mt-20 grid w-full gap-6 sm:grid-cols-3">
        {features.map((feature) => (
          <Card key={feature.title} className="text-left">
            <CardHeader>
              <feature.icon className="mb-2 h-6 w-6 text-primary" />
              <CardTitle className="text-base">{feature.title}</CardTitle>
              <CardDescription>{feature.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </section>
  );
}
