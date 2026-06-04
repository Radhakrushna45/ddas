import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Database, Shield, Zap, FileSearch, ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
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
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Ambient gradient + floating blobs */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-hero" />
      <div className="pointer-events-none absolute -left-32 top-20 h-72 w-72 rounded-full bg-primary/20 blur-3xl animate-blob" />
      <div className="pointer-events-none absolute right-0 top-40 h-96 w-96 rounded-full bg-accent/40 blur-3xl animate-blob [animation-delay:-6s]" />

      <header className="relative z-10 border-b border-border/60 backdrop-blur-md bg-background/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground shadow-glow">
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
                <Button className="bg-gradient-primary shadow-elegant hover:opacity-95" onClick={() => navigate({ to: "/auth" })}>Get started</Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto max-w-6xl px-6 py-24 text-center md:py-32">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur animate-fade-up">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Centralized duplicate detection · powered by SHA-256
          </div>
          <h1 className="text-balance text-5xl font-bold tracking-tight text-foreground md:text-7xl animate-fade-up [animation-delay:80ms]">
            Stop downloading <br className="hidden md:block" />
            the same data <span className="text-gradient">twice.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground animate-fade-up [animation-delay:160ms]">
            DDAS fingerprints every dataset your team registers and instantly alerts you when a duplicate
            already exists — saving storage, bandwidth, and time.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3 animate-fade-up [animation-delay:240ms]">
            <Button size="lg" className="bg-gradient-primary shadow-elegant transition-transform hover:scale-[1.02] hover:opacity-95" onClick={() => navigate({ to: hasSession ? "/dashboard" : "/auth" })}>
              {hasSession ? "Go to dashboard" : "Start tracking downloads"}
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" className="backdrop-blur" onClick={() => navigate({ to: "/auth" })}>
              Create free account
            </Button>
          </div>

          <div className="mt-10 flex flex-wrap justify-center gap-6 text-xs text-muted-foreground animate-fade-up [animation-delay:320ms]">
            {["Local fingerprinting", "Zero file uploads", "Realtime registry"].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-success" /> {t}
              </span>
            ))}
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-5 px-6 pb-28 md:grid-cols-3">
          {[
            { icon: FileSearch, title: "Hash-based detection", desc: "SHA-256 fingerprints catch duplicates even if the filename changes." },
            { icon: Shield, title: "Private to you", desc: "Your registry is yours alone — isolated per account with row-level security." },
            { icon: Zap, title: "Instant alerts", desc: "Get notified the moment a duplicate is detected, with full metadata." },
          ].map((f, i) => (
            <div
              key={f.title}
              style={{ animationDelay: `${i * 100}ms` }}
              className="group relative overflow-hidden rounded-2xl border border-border bg-gradient-card p-6 shadow-elegant transition-all hover:-translate-y-1 hover:shadow-glow animate-fade-up"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow transition-transform group-hover:scale-110">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold text-card-foreground">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="relative z-10 border-t border-border/60">
        <div className="mx-auto max-w-6xl px-6 py-6 text-center text-sm text-muted-foreground">
          DDAS — Data Download Duplication Alert System
        </div>
      </footer>
    </div>
  );
}
