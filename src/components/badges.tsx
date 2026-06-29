import { EyeOff, Table2 } from "lucide-react";

const STATUS: Record<
  string,
  { label: string; tone: "leaf" | "amber" | "faint" | "alert"; pulse?: boolean }
> = {
  ready: { label: "Ready", tone: "leaf" },
  provisioning: { label: "Provisioning", tone: "amber", pulse: true },
  migrating: { label: "Migrating", tone: "amber", pulse: true },
  masking: { label: "Masking", tone: "amber", pulse: true },
  tearing_down: { label: "Tearing down", tone: "amber", pulse: true },
  paused: { label: "Paused", tone: "faint" },
  error: { label: "Error", tone: "alert" },
  deleted: { label: "Deleted", tone: "faint" },
};

const TONE: Record<string, { pill: string; dot: string }> = {
  leaf: { pill: "bg-leaf/10 text-leaf", dot: "bg-leaf" },
  amber: { pill: "bg-amber/10 text-amber", dot: "bg-amber" },
  faint: { pill: "bg-ink-faint/10 text-ink-muted", dot: "bg-ink-faint" },
  alert: { pill: "bg-alert/10 text-alert", dot: "bg-alert" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? STATUS.error;
  const tone = TONE[s.tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${tone.pill}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${tone.dot} ${s.pulse ? "animate-pulse" : ""}`}
      />
      {s.label}
    </span>
  );
}

export function ModeBadge({ mode }: { mode: string }) {
  if (mode === "schema_only") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-raised px-2 py-1 text-xs font-medium text-ink-muted">
        <Table2 className="h-3 w-3" /> Schema-only
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-leaf/25 bg-leaf/5 px-2 py-1 text-xs font-medium text-leaf">
      <EyeOff className="h-3 w-3" /> Masked clone
    </span>
  );
}
