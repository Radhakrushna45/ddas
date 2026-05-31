import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Database, Shield, Zap, FileSearch, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DDAS — Data Download Duplication Alert System" },
      { name: "description", content: "Detect duplicate data downloads across your organization with hash-based file fingerprinting." },
      { property: "og:title", content: "DDAS — Data Download Duplication Alert System" },
      { property: "og:description", content: "Stop wasting storage and bandwidth. DDAS centrally tracks downloads and alerts you when a dataset already exists." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setHasSession(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setHasSession(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Database className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold tracking-tight">DDAS</span>
          </div>
          <div className="flex gap-2">
            {hasSession ? (
              <Button onClick={() => navigate({ to: "/dashboard" })}>Open dashboard</Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => navigate({ to: "/auth" })}>Sign in</Button>
                <Button onClick={() => navigate({ to: "/auth" })}>Get started</Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-6 py-24 text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-success" /> Centralized duplicate detection
          </div>
          <h1 className="text-balance text-5xl font-bold tracking-tight text-foreground md:text-6xl">
            Stop downloading the same data twice.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground">
            DDAS fingerprints every dataset your team registers and instantly alerts you when a duplicate
            already exists — saving storage, bandwidth, and time.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Button size="lg" onClick={() => navigate({ to: hasSession ? "/dashboard" : "/auth" })}>
              {hasSession ? "Go to dashboard" : "Start tracking downloads"}
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-24 md:grid-cols-3">
          {[
            { icon: FileSearch, title: "Hash-based detection", desc: "SHA-256 fingerprints catch duplicates even if the filename changes." },
            { icon: Shield, title: "Cross-user visibility", desc: "See what teammates have already downloaded across the organization." },
            { icon: Zap, title: "Instant alerts", desc: "Get notified the moment a duplicate is detected, with full metadata." },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-border bg-card p-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-card-foreground">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-6 text-center text-sm text-muted-foreground">
          DDAS — Data Download Duplication Alert System
        </div>
      </footer>
    </div>
  );
}
