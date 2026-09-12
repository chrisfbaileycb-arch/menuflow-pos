import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Copy,
  KeyRound,
  Link2,
  LogOut,
  Play,
  Plus,
  Trash2,
  Zap,
  CircleAlert,
  Plug,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";

/** Minimal shape returned by the connectors list query. */
type ConnectorListItem = {
  _id: Id<"connectors">;
  publicId: string;
  name: string;
  targetUrl: string;
  description: string;
  hasApiKey: boolean;
  createdAt: number;
};

/** Shape returned by the triggerConnector action (mirrors the server.js envelope). */
type TriggerResult = {
  success: boolean;
  connectorName?: string;
  status: number;
  data: unknown;
  error?: string;
};

const SAMPLE_PAYLOAD = `{
  "event": "menu.updated",
  "restaurant": "Demo Diner",
  "items": [
    { "name": "Burger", "price": 15.0, "modifiers": ["Medium Rare", "Well Done"] }
  ]
}`;

function statusTone(status: number): "success" | "error" | "warn" {
  if (status >= 200 && status < 300) return "success";
  if (status >= 400 && status < 500) return "warn";
  return "error";
}

function StatusPill({ status }: { status: number }) {
  const tone = statusTone(status);
  const map = {
    success: "bg-[#dcefe2] text-[#355547]",
    warn: "bg-[#fde9d2] text-[#a05624]",
    error: "bg-[#fee5dd] text-[#a34f43]",
  } as const;
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${map[tone]}`}>{status}</span>;
}

export default function Connectors() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const connectorsQuery = useQuery(api.connectors.listMyConnectors);
  const connectors = connectorsQuery ?? [];
  const isLoading = connectorsQuery === undefined;
  const addConnector = useMutation(api.connectors.addConnector);
  const addDemoConnector = useMutation(api.connectors.addDemoConnector);
  const deleteConnector = useMutation(api.connectors.deleteConnector);
  const triggerConnector = useAction(api.connectorsTrigger.triggerConnector);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", targetUrl: "", apiKey: "", description: "" });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [triggeringId, setTriggeringId] = useState<string | null>(null);
  const [triggerResult, setTriggerResult] = useState<TriggerResult | null>(null);
  const [payloadText, setPayloadText] = useState(SAMPLE_PAYLOAD);
  const [hasSeededDemo, setHasSeededDemo] = useState(false);

  // Seed the demo Echo connector once when a user has none (restores the original
  // server.js default demo data in registry form).
  if (connectors.length === 0 && !isLoading && !hasSeededDemo) {
    setHasSeededDemo(true);
    void addDemoConnector();
  }

  const handleAdd = async () => {
    setFormError(null);
    if (!form.name.trim() || !form.targetUrl.trim()) {
      setFormError("Name and Target URL are required.");
      return;
    }
    setIsSaving(true);
    try {
      await addConnector({
        name: form.name,
        targetUrl: form.targetUrl,
        apiKey: form.apiKey || undefined,
        description: form.description || undefined,
      });
      toast.success(`Connector "${form.name}" created`);
      setForm({ name: "", targetUrl: "", apiKey: "", description: "" });
      setIsAddOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (publicId: string) => {
    try {
      await deleteConnector({ publicId });
      toast.success("Connector removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove connector");
    }
  };

  const handleTrigger = async (publicId: string) => {
    setTriggeringId(publicId);
    setTriggerResult(null);
    let payload: unknown;
    try {
      payload = JSON.parse(payloadText);
    } catch {
      toast.error("Payload is not valid JSON.");
      setTriggeringId(null);
      return;
    }
    try {
      const result = (await triggerConnector({ publicId, payload })) as TriggerResult;
      setTriggerResult(result);
      if (result.success) {
        toast.success(`Triggered ${result.connectorName ?? "connector"} — ${result.status}`);
      } else {
        toast.error(result.error ?? "Trigger failed");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Trigger failed");
    } finally {
      setTriggeringId(null);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <main className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-[1440px]">
        {/* Left Sidebar */}
        <aside className="hidden min-h-screen w-[248px] shrink-0 flex-col border-r border-foreground/10 px-5 py-6 lg:flex">
          <Link to="/dashboard" className="flex items-center gap-3 px-2">
            <div className="clay-icon flex size-10 items-center justify-center rounded-2xl bg-[#8fb4e3] text-[#2b4260]">
              <Zap className="size-5" />
            </div>
            <div>
              <p className="font-display text-lg font-bold tracking-tight">connectors</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                trigger hub
              </p>
            </div>
          </Link>

          <div className="mt-10 px-2 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
            Workspace
          </div>
          <nav className="mt-3 space-y-2">
            <Link
              to="/dashboard"
              className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm text-muted-foreground transition hover:bg-white/50"
            >
              Import menu
            </Link>
            <div className="flex items-center gap-3 rounded-2xl bg-[#8fb4e3]/30 px-3 py-3 text-sm font-semibold text-[#2b4260] shadow-[inset_0_1px_0_rgba(255,255,255,.55)]">
              <Plug className="size-4" />
              API connectors
            </div>
          </nav>

          <div className="mt-8 rounded-[20px] bg-[#eef4fb]/70 p-3.5 text-xs text-[#3d5a7d]">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#4c7cb8]">
              <Zap className="size-3.5" />
              Universal trigger
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              One POST per connector. Your API key is attached automatically as a Bearer token, with a 15s timeout.
            </p>
          </div>

          <div className="mt-auto rounded-[24px] bg-[#dce9f8] p-4 text-[#2b4260] shadow-[8px_8px_0_rgba(70,104,153,.1),inset_0_1px_0_rgba(255,255,255,.75)]">
            <KeyRound className="size-5" />
            <p className="mt-3 text-sm font-semibold">Keys stay server-side.</p>
            <p className="mt-1 text-xs leading-5 text-[#46698f]">
              API keys are stored in the Convex backend and never sent to the browser.
            </p>
          </div>
        </aside>

        {/* Main Content Area */}
        <section className="min-w-0 flex-1 px-4 py-5 sm:px-8 lg:px-12 lg:py-8">
          <header className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 lg:hidden">
              <div className="clay-icon flex size-10 items-center justify-center rounded-2xl bg-[#8fb4e3] text-[#2b4260]">
                <Zap className="size-5" />
              </div>
              <span className="font-display text-lg font-bold">connectors</span>
            </div>
            <div className="hidden text-sm text-muted-foreground sm:block">
              <Link to="/dashboard" className="font-medium text-foreground hover:underline">
                Workspace
              </Link>
              <span className="mx-2">/</span>
              API connectors
            </div>
            <div className="ml-auto flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-semibold">{user?.name || "Operator"}</p>
                <p className="text-xs text-muted-foreground">Connector workspace</p>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="clay-icon flex size-10 items-center justify-center rounded-2xl bg-white/70 text-muted-foreground transition-transform hover:-translate-y-0.5"
                aria-label="Sign out"
              >
                <LogOut className="size-4" />
              </button>
            </div>
          </header>

          <div className="mx-auto mt-8 max-w-[1060px]">
            {/* Title */}
            <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div>
                <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#4c7cb8]">
                  <span className="size-2 rounded-full bg-[#5a8fd0]" />
                  API connector registry
                </div>
                <h1 className="font-display text-4xl font-bold tracking-[-0.045em] text-[#2e3a4a] sm:text-5xl">
                  Manage &amp; trigger<br className="hidden sm:block" />{" "}
                  <span className="text-[#4c7cb8]">your endpoints.</span>
                </h1>
                <p className="mt-3 max-w-xl text-base leading-7 text-muted-foreground">
                  Register any HTTP endpoint, attach an API key, and fire JSON payloads at it with one click —
                  all proxied through the backend so credentials never touch the browser.
                </p>
              </div>

              <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogTrigger asChild>
                  <Button className="rounded-2xl bg-[#2e3a4a] px-5 text-white shadow-[0_5px_0_#1c2632] hover:bg-[#3b4a5e] hover:shadow-[0_3px_0_#1c2632]">
                    <Plus className="size-4" />
                    Add connector
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-[26px] border-none bg-[#fdf9f2] sm:max-w-[440px]">
                  <DialogHeader>
                    <DialogTitle className="font-display text-xl font-bold text-[#2e3a4a]">
                      New API connector
                    </DialogTitle>
                    <DialogDescription className="text-sm text-muted-foreground">
                      Register an endpoint to trigger with JSON payloads.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="connector-name" className="text-xs font-bold uppercase tracking-wider text-[#5a6a7d]">
                        Name
                      </Label>
                      <Input
                        id="connector-name"
                        placeholder="Demo Echo Service"
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        className="rounded-xl border-[#d8e2ee] bg-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="connector-url" className="text-xs font-bold uppercase tracking-wider text-[#5a6a7d]">
                        Target URL
                      </Label>
                      <Input
                        id="connector-url"
                        placeholder="https://httpbin.org/post"
                        value={form.targetUrl}
                        onChange={(e) => setForm((f) => ({ ...f, targetUrl: e.target.value }))}
                        className="rounded-xl border-[#d8e2ee] bg-white font-mono text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="connector-key" className="text-xs font-bold uppercase tracking-wider text-[#5a6a7d]">
                        API key <span className="font-normal normal-case text-muted-foreground">(optional)</span>
                      </Label>
                      <Input
                        id="connector-key"
                        type="password"
                        placeholder="Sent as: Authorization: Bearer …"
                        value={form.apiKey}
                        onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                        className="rounded-xl border-[#d8e2ee] bg-white font-mono text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="connector-desc" className="text-xs font-bold uppercase tracking-wider text-[#5a6a7d]">
                        Description <span className="font-normal normal-case text-muted-foreground">(optional)</span>
                      </Label>
                      <Textarea
                        id="connector-desc"
                        placeholder="What does this endpoint do?"
                        value={form.description}
                        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                        className="min-h-[64px] rounded-xl border-[#d8e2ee] bg-white text-sm"
                      />
                    </div>
                    {formError && (
                      <p className="rounded-xl bg-[#fee5dd] px-3 py-2 text-xs font-semibold text-[#a34f43]">
                        {formError}
                      </p>
                    )}
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      onClick={handleAdd}
                      disabled={isSaving}
                      className="rounded-2xl bg-[#2e3a4a] px-5 text-white shadow-[0_4px_0_#1c2632] hover:bg-[#3b4a5e]"
                    >
                      {isSaving ? "Saving…" : "Create connector"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {/* Trigger Console */}
            <div className="clay-surface mt-8 rounded-[30px] p-5 sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="flex size-9 items-center justify-center rounded-xl bg-[#dbe7f6] text-[#3d5a7d]">
                      <Play className="size-4" />
                    </div>
                    <h2 className="font-display text-xl font-bold text-[#2e3a4a]">Trigger console</h2>
                  </div>
                  <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
                    Edit the JSON payload below, then fire it at any connector with its Trigger button.
                  </p>
                </div>
                <Badge className="hidden rounded-full bg-[#dbe7f6] px-3 py-1 text-[#3d5a7d] shadow-none sm:inline-flex">
                  POST · 15s timeout
                </Badge>
              </div>

              <div className="mt-5">
                <Textarea
                  value={payloadText}
                  onChange={(e) => setPayloadText(e.target.value)}
                  spellCheck={false}
                  aria-label="JSON payload"
                  className="min-h-[190px] rounded-2xl border-[#d8e2ee] bg-[#f7fafd] font-mono text-xs leading-relaxed"
                />
              </div>

              {triggerResult && (
                <div className="mt-4 rounded-2xl bg-[#f2f7fc] p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill status={triggerResult.status} />
                    <span className="text-sm font-bold text-[#2e3a4a]">
                      {triggerResult.success ? "Success" : "Failed"}
                    </span>
                    {triggerResult.connectorName && (
                      <span className="text-xs text-muted-foreground">via {triggerResult.connectorName}</span>
                    )}
                    {triggerResult.error && (
                      <span className="text-xs font-semibold text-[#a34f43]">{triggerResult.error}</span>
                    )}
                  </div>
                  <pre className="mt-3 max-h-56 overflow-auto rounded-xl bg-[#1f2937] p-3 font-mono text-[11px] leading-relaxed text-[#d7e4f2]">
                    {typeof triggerResult.data === "string"
                      ? triggerResult.data
                      : JSON.stringify(triggerResult.data, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Connector List */}
            <div className="mt-8">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl font-bold tracking-tight text-[#2e3a4a]">
                  Your connectors
                </h2>
                <Badge className="bg-[#e4eef9] text-[#3d5a7d] shadow-none">
                  {connectors.length} registered
                </Badge>
              </div>

              {isLoading ? (
                <div className="clay-surface mt-4 flex min-h-[160px] items-center justify-center rounded-[26px] text-sm text-muted-foreground">
                  Loading connectors…
                </div>
              ) : connectors.length === 0 ? (
                <div className="clay-surface mt-4 flex min-h-[220px] flex-col items-center justify-center rounded-[26px] px-6 py-12 text-center">
                  <div className="flex size-14 items-center justify-center rounded-[20px] bg-[#dbe7f6] text-[#5a8fd0]">
                    <Plug className="size-6" />
                  </div>
                  <p className="mt-4 font-display font-bold text-[#2e3a4a]">No connectors yet</p>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                    Add your first endpoint above to start triggering JSON payloads.
                  </p>
                </div>
              ) : (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {connectors.map((c: ConnectorListItem) => (
                    <div
                      key={c._id}
                      className="clay-surface flex flex-col rounded-[26px] p-5 transition-transform hover:-translate-y-0.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-display text-lg font-bold text-[#2e3a4a]">{c.name}</p>
                          <p className="mt-0.5 flex items-center gap-1 truncate font-mono text-[11px] text-muted-foreground">
                            <Link2 className="size-3 shrink-0" />
                            {c.targetUrl}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {c.hasApiKey && (
                            <span
                              className="clay-icon flex size-7 items-center justify-center rounded-lg bg-[#fde9d2] text-[#a05624]"
                              title="API key attached (Bearer)"
                            >
                              <KeyRound className="size-3.5" />
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDelete(c.publicId)}
                            className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-[#fee5dd] hover:text-[#a34f43]"
                            aria-label={`Delete ${c.name}`}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>

                      {c.description && (
                        <p className="mt-3 text-xs leading-5 text-muted-foreground">{c.description}</p>
                      )}

                      <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#eef4fb] px-2.5 py-1.5">
                        <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-[#3d5a7d]">
                          {c.publicId}
                        </code>
                        <button
                          type="button"
                          onClick={() => {
                            void navigator.clipboard.writeText(c.publicId);
                            toast.success("Connector ID copied");
                          }}
                          className="text-[#3d5a7d] transition hover:text-[#1c2632]"
                          aria-label="Copy connector ID"
                        >
                          <Copy className="size-3.5" />
                        </button>
                      </div>

                      <Button
                        type="button"
                        onClick={() => handleTrigger(c.publicId)}
                        disabled={triggeringId !== null}
                        className="mt-4 w-full rounded-2xl bg-[#3d5a7d] text-white shadow-[0_4px_0_#24364b] hover:bg-[#466991] hover:shadow-[0_2px_0_#24364b] disabled:opacity-60"
                      >
                        {triggeringId === c.publicId ? (
                          <>
                            <span className="size-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                            Triggering…
                          </>
                        ) : (
                          <>
                            <Zap className="size-4" />
                            Trigger
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Info Cards */}
            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <div className="rounded-[24px] bg-[#dbe7f6] p-4 text-[#2b4260] shadow-[6px_6px_0_rgba(70,104,153,.1),inset_0_1px_0_rgba(255,255,255,.6)]">
                <p className="font-display text-sm font-bold">1. Register</p>
                <p className="mt-1 text-xs leading-5 text-[#46698f]">
                  Add any HTTP endpoint with an optional API key.
                </p>
              </div>
              <div className="rounded-[24px] bg-[#e4f1e7] p-4 text-[#355547] shadow-[6px_6px_0_rgba(68,104,83,.1),inset_0_1px_0_rgba(255,255,255,.6)]">
                <p className="font-display text-sm font-bold">2. Compose</p>
                <p className="mt-1 text-xs leading-5 text-[#557665]">
                  Build your JSON payload once in the trigger console.
                </p>
              </div>
              <div className="rounded-[24px] bg-[#fde9d2] p-4 text-[#7a4c1d] shadow-[6px_6px_0_rgba(160,86,36,.1),inset_0_1px_0_rgba(255,255,255,.6)]">
                <p className="font-display text-sm font-bold">3. Fire</p>
                <p className="mt-1 text-xs leading-5 text-[#96702f]">
                  Trigger any connector and inspect the live response.
                </p>
              </div>
            </div>

            {/* Error hint */}
            {connectors.length === 0 && !isLoading && (
              <div className="mt-6 flex items-start gap-3 rounded-2xl bg-[#eef4fb] px-4 py-3 text-sm text-[#3d5a7d]">
                <CircleAlert className="mt-0.5 size-4 shrink-0" />
                <p className="text-xs leading-relaxed">
                  Tip: use <span className="font-mono font-bold">https://httpbin.org/post</span> as a test
                  target — it echoes back exactly what you send.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
