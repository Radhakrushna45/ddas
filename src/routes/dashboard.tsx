import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  AlertTriangle, CheckCircle2, Database, FileUp, LogOut, Trash2, Search,
  FileText, HardDrive, Users, UploadCloud, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — DDAS" },
      { name: "description", content: "Register downloaded datasets and instantly detect duplicates across your team." },
    ],
  }),
  component: Dashboard,
});

type Download = {
  id: string;
  user_id: string;
  file_name: string;
  file_hash: string;
  file_size: number;
  mime_type: string | null;
  location: string | null;
  notes: string | null;
  created_at: string;
  storage_path: string | null;
};

type Profile = { id: string; display_name: string | null; email: string | null };

function formatBytes(n: number) {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(n) / Math.log(1024));
  return `${(n / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

async function sha256(file: File, onProgress?: (pct: number) => void): Promise<string> {
  const total = file.size;
  const chunkSize = 1024 * 1024; // 1 MB
  let offset = 0;
  const chunks: ArrayBuffer[] = [];

  while (offset < total) {
    const blob = file.slice(offset, Math.min(offset + chunkSize, total));
    const buf = await blob.arrayBuffer();
    chunks.push(buf);
    offset += chunkSize;
    onProgress?.(Math.min((offset / total) * 100, 95));
  }

  // Concatenate all chunks
  let totalLen = 0;
  chunks.forEach((c) => (totalLen += c.byteLength));
  const merged = new Uint8Array(totalLen);
  let pos = 0;
  chunks.forEach((c) => {
    merged.set(new Uint8Array(c), pos);
    pos += c.byteLength;
  });

  onProgress?.(100);
  const hash = await crypto.subtle.digest("SHA-256", merged.buffer);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function Dashboard() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [downloads, setDownloads] = useState<Download[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [hashing, setHashing] = useState(false);
  const [hashProgress, setHashProgress] = useState(0);
  const [pending, setPending] = useState<{
    file: File; hash: string; duplicates: Download[];
  } | null>(null);
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (!s) navigate({ to: "/auth" });
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate({ to: "/auth" });
      else setSession(data.session);
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const loadData = async () => {
    setLoading(true);
    const [{ data: dls }, { data: profs }] = await Promise.all([
      supabase.from("downloads").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, display_name, email"),
    ]);
    setDownloads((dls as Download[]) ?? []);
    const map: Record<string, Profile> = {};
    (profs ?? []).forEach((p: Profile) => (map[p.id] = p));
    setProfiles(map);
    setLoading(false);
  };

  useEffect(() => {
    if (!session) return;
    loadData();
    const channel = supabase
      .channel("downloads-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "downloads" }, () => loadData())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);

  const processFile = useCallback(async (file: File) => {
    setHashing(true);
    setHashProgress(0);
    try {
      const hash = await sha256(file, (pct) => setHashProgress(pct));
      const duplicates = downloads.filter((d) => d.file_hash === hash);
      setPending({ file, hash, duplicates });
      if (duplicates.length) {
        toast.warning(`Duplicate detected — ${duplicates.length} existing copy${duplicates.length > 1 ? "ies" : ""}.`);
      } else {
        toast.success("No duplicates found. Ready to register.");
      }
    } catch (err) {
      toast.error("Failed to read file");
      console.error(err);
    } finally {
      setHashing(false);
      setHashProgress(0);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [downloads]);

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    void processFile(file);
  };

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    void processFile(file);
  }, [processFile]);

  const register = async () => {
    if (!pending || !session) return;
    const { error } = await supabase.from("downloads").insert({
      user_id: session.user.id,
      file_name: pending.file.name,
      file_hash: pending.hash,
      file_size: pending.file.size,
      mime_type: pending.file.type || null,
      location: location || null,
      notes: notes || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Download registered");
    setPending(null);
    setLocation("");
    setNotes("");
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("downloads").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removed");
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return downloads;
    return downloads.filter(
      (d) =>
        d.file_name.toLowerCase().includes(q) ||
        d.file_hash.toLowerCase().includes(q) ||
        (d.location ?? "").toLowerCase().includes(q),
    );
  }, [downloads, query]);

  const stats = useMemo(() => {
    const hashes = new Map<string, number>();
    let totalSize = 0;
    downloads.forEach((d) => {
      hashes.set(d.file_hash, (hashes.get(d.file_hash) ?? 0) + 1);
      totalSize += Number(d.file_size);
    });
    const duplicateGroups = Array.from(hashes.values()).filter((c) => c > 1).length;
    const wasted = downloads.reduce((acc, d) => {
      const count = hashes.get(d.file_hash) ?? 1;
      return count > 1 ? acc + Number(d.file_size) * (1 - 1 / count) : acc;
    }, 0);
    return { total: downloads.length, unique: hashes.size, duplicateGroups, totalSize, wasted };
  }, [downloads]);

  if (!session) return null;

  const me = profiles[session.user.id];
  const displayName = me?.display_name || session.user.email?.split("@")[0] || "User";

  const dropActive = isDragging || hashing;

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[400px] bg-gradient-hero" />

      <header className="relative z-10 border-b border-border/60 bg-card/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight">DDAS</div>
              <div className="text-xs text-muted-foreground">Signed in as <span className="font-medium text-foreground">{displayName}</span></div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl space-y-6 px-6 py-8">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4 animate-fade-up">
          <StatCard icon={FileText} label="Total downloads" value={stats.total.toString()} />
          <StatCard icon={CheckCircle2} label="Unique datasets" value={stats.unique.toString()} />
          <StatCard icon={AlertTriangle} label="Duplicate groups" value={stats.duplicateGroups.toString()} tone={stats.duplicateGroups ? "warning" : "default"} />
          <StatCard icon={HardDrive} label="Storage wasted" value={formatBytes(stats.wasted)} tone={stats.wasted ? "warning" : "default"} />
        </div>

        {/* Register */}
        <section className="rounded-2xl border border-border bg-gradient-card p-6 shadow-elegant">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground shadow-glow">
              <FileUp className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Register a download</h2>
              <p className="text-sm text-muted-foreground">
                Drop a file anywhere below — we compute its SHA-256 locally and check the registry instantly.
              </p>
            </div>
          </div>

          {/* Drop zone */}
          <div
            ref={dropRef}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={`mt-5 flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-all ${
              dropActive
                ? "border-primary bg-primary/5 scale-[1.01] shadow-glow"
                : "border-border bg-background/50 hover:border-primary/40 hover:bg-accent/20"
            }`}
          >
            <input ref={fileRef} type="file" onChange={onPickFile} className="hidden" id="file-picker" />

            {hashing ? (
              <div className="flex w-full max-w-md flex-col items-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <div className="w-full">
                  <div className="mb-1.5 flex justify-between text-xs font-medium">
                    <span className="text-muted-foreground">Computing fingerprint…</span>
                    <span className="text-primary">{Math.round(hashProgress)}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-primary/10">
                    <div
                      className="h-full rounded-full bg-gradient-primary transition-all duration-200"
                      style={{ width: `${hashProgress}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <label htmlFor="file-picker" className="flex cursor-pointer flex-col items-center gap-3">
                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl transition-all ${dropActive ? "bg-primary text-primary-foreground shadow-glow scale-110" : "bg-secondary text-secondary-foreground"}`}>
                  <UploadCloud className="h-7 w-7" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {isDragging ? "Drop file to scan" : "Drag & drop a file here, or click to browse"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Any file type · hashed locally in your browser · never uploaded
                  </p>
                </div>
              </label>
            )}
          </div>

          {/* Pending result */}
          {pending && (
            <div className="mt-6 space-y-4 rounded-lg border border-border bg-background p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
                    <FileUp className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-medium">{pending.file.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {formatBytes(pending.file.size)} · {pending.file.type || "unknown type"}
                    </div>
                    <div className="mt-2 break-all font-mono text-xs text-muted-foreground">
                      sha256: {pending.hash}
                    </div>
                  </div>
                </div>
                {pending.duplicates.length > 0 ? (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3 w-3" /> {pending.duplicates.length} duplicate
                    {pending.duplicates.length > 1 ? "s" : ""}
                  </Badge>
                ) : (
                  <Badge className="gap-1 bg-success text-success-foreground hover:bg-success/90">
                    <CheckCircle2 className="h-3 w-3" /> Unique
                  </Badge>
                )}
              </div>

              {pending.duplicates.length > 0 && (
                <div className="rounded-md border border-warning/40 bg-warning/10 p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    This dataset already exists in the registry
                  </div>
                  <ul className="space-y-1 text-sm">
                    {pending.duplicates.map((d) => (
                      <li key={d.id} className="text-muted-foreground">
                        <span className="font-medium text-foreground">{d.file_name}</span> — registered by{" "}
                        {profiles[d.user_id]?.display_name || "someone"} on{" "}
                        {new Date(d.created_at).toLocaleString()}
                        {d.location && <> · location: <span className="font-mono">{d.location}</span></>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="loc">Storage location (optional)</Label>
                  <Input id="loc" placeholder="/data/research/2026/" value={location} onChange={(e) => setLocation(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Textarea id="notes" rows={1} placeholder="Source URL, purpose…" value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={register}>
                  {pending.duplicates.length > 0 ? "Register anyway" : "Register download"}
                </Button>
                <Button variant="ghost" onClick={() => { setPending(null); setLocation(""); setNotes(""); }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* Registry */}
        <section className="rounded-2xl border border-border bg-gradient-card shadow-elegant">

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
            <div>
              <h2 className="text-lg font-semibold">Registry</h2>
              <p className="text-xs text-muted-foreground">
                Your private download registry · <Users className="inline h-3 w-3" /> visible only to you
              </p>
            </div>
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Search name, hash, location…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm text-muted-foreground">Loading registry…</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 p-10 text-center">
              {downloads.length === 0 ? (
                <>
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
                    <UploadCloud className="h-8 w-8" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Your registry is empty</p>
                    <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                      Drop a file into the register section above to compute its fingerprint and start tracking downloads. Every file you add is checked against duplicates instantly.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <Search className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">No matches found</p>
                  <p className="max-w-xs text-xs text-muted-foreground">
                    Try adjusting your search — you can look up by filename, SHA-256 hash, or storage location.
                  </p>
                </>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((d) => {
                const dupCount = downloads.filter((x) => x.file_hash === d.file_hash).length;
                const isDup = dupCount > 1;
                const owner = profiles[d.user_id];
                const mine = d.user_id === session.user.id;
                return (
                  <li key={d.id} className="flex flex-wrap items-start justify-between gap-3 p-4 transition-colors hover:bg-accent/40">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium">{d.file_name}</span>
                        {isDup && (
                          <Badge variant="outline" className="gap-1 border-warning/50 text-warning">
                            <AlertTriangle className="h-3 w-3" /> {dupCount}×
                          </Badge>
                        )}
                        {mine && <Badge variant="secondary">you</Badge>}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {formatBytes(Number(d.file_size))} · {d.mime_type || "—"} · by{" "}
                        {owner?.display_name || owner?.email || "unknown"} ·{" "}
                        {new Date(d.created_at).toLocaleString()}
                      </div>
                      {d.location && (
                        <div className="mt-1 truncate font-mono text-xs text-muted-foreground">📁 {d.location}</div>
                      )}
                      <div className="mt-1 truncate font-mono text-[10px] text-muted-foreground/70">{d.file_hash}</div>
                      {d.notes && <div className="mt-1 text-sm text-foreground/80">{d.notes}</div>}
                    </div>
                    {mine && (
                      <Button variant="ghost" size="icon" onClick={() => remove(d.id)} aria-label="Delete">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function StatCard({
  icon: Icon, label, value, tone = "default",
}: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; tone?: "default" | "warning" }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-gradient-card p-5 shadow-elegant transition-all hover:-translate-y-0.5 hover:shadow-glow">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl transition-transform group-hover:scale-110 ${tone === "warning" ? "bg-warning/15 text-warning" : "bg-gradient-primary text-primary-foreground shadow-glow"}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3 text-3xl font-bold tracking-tight">{value}</div>
    </div>
  );
}
