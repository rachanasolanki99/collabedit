import Link from "next/link";
import { FileText, WifiOff, GitBranch, ShieldCheck, Sparkles, Users } from "lucide-react";
import { auth } from "@/lib/auth";
import { site } from "@/lib/site";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/footer";
import { ThemeToggle } from "@/components/theme-toggle";

const features = [
  { icon: WifiOff, title: "Local-first & offline", body: "Your document lives in the browser. Open, edit and close with zero network round-trips — even on a plane." },
  { icon: Users, title: "Deterministic merge", body: "Real-time collaboration backed by CRDTs. Concurrent edits reconcile automatically, with no lost work." },
  { icon: GitBranch, title: "Version time-travel", body: "Snapshot any moment, browse the timeline and restore safely without corrupting live collaborators." },
  { icon: ShieldCheck, title: "Roles & isolation", body: "Owner / Editor / Viewer permissions enforced end-to-end. Viewers can read but never write." },
  { icon: Sparkles, title: "AI assists", body: "Summarize a document, explain what changed between versions — powered by Gemini." },
  { icon: FileText, title: "Rich text", body: "Headings, lists, quotes and code, all synchronized character-by-character." },
];

export default async function LandingPage() {
  const session = await auth();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5">
        <span className="inline-flex items-center gap-2 font-semibold">
          <FileText className="size-5 text-primary" />
          {site.name}
        </span>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {session?.user ? (
            <Button asChild>
              <Link href="/documents">Open app</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild>
                <Link href="/register">Get started</Link>
              </Button>
            </>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4">
        <section className="py-16 text-center sm:py-24">
          <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground">
            <span className="size-2 rounded-full bg-emerald-500" />
            CRDT sync · offline queue · version control
          </div>
          <h1 className="mx-auto max-w-3xl text-balance text-4xl font-bold tracking-tight sm:text-5xl">
            A local-first collaborative editor that never loses your work
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg text-muted-foreground">
            Write together in real time, keep editing when the network drops, and
            reconcile everything deterministically the moment you reconnect.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href={session?.user ? "/documents" : "/register"}>
                {session?.user ? "Go to your documents" : "Start writing free"}
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-4 pb-20 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-lg border border-border bg-card p-5">
              <f.icon className="size-6 text-primary" />
              <h3 className="mt-3 font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </section>
      </main>

      <Footer />
    </div>
  );
}
