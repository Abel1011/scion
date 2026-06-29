"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { StatCards } from "./stat-cards";
import { LineageTree } from "./lineage-tree";
import { BranchTable } from "./branch-table";
import { DeployRequestCard } from "./deploy-request-card";
import { MaskedDataCard } from "./masked-data-card";
import { NewBranchModal } from "./new-branch-modal";
import { BranchDetailDrawer } from "./branch-detail-drawer";
import { api, type CreateBranchInput, type MaskedData, type Stats } from "@/lib/api";
import type { BranchView, DeployRequestView, GoldenView } from "@/lib/views";

export function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [branches, setBranches] = useState<BranchView[]>([]);
  const [goldens, setGoldens] = useState<GoldenView[]>([]);
  const [dr, setDr] = useState<DeployRequestView | null>(null);
  const [maskedData, setMaskedData] = useState<MaskedData | null>(null);
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [activeBranch, setActiveBranch] = useState<BranchView | null>(null);
  const [creating, setCreating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [s, b, g, d] = await Promise.all([
        api.stats(),
        api.branches(),
        api.goldens(),
        api.deployRequests(),
      ]);
      setStats(s);
      setBranches(b.branches);
      setGoldens(g.goldens);
      const list = d.deployRequests;
      // Headline the actionable one; never surface a closed/cancelled request
      // (e.g. left behind by a pruned branch) as if it were still pending.
      setDr(
        list.find((x) => x.status === "open") ??
          list.find((x) => x.status === "approved") ??
          list.find((x) => x.status === "applied") ??
          null,
      );
    } catch {
      /* ignore transient poll errors */
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 1800);
    return () => clearInterval(id);
  }, [refresh]);

  // Drive the provisioning worker while the dashboard is open (in production a
  // Vercel Cron also hits this endpoint).
  useEffect(() => {
    const tick = () =>
      void fetch("/api/worker/tick", { method: "POST" }).catch(() => {});
    tick();
    const id = setInterval(tick, 8000);
    return () => clearInterval(id);
  }, []);

  const createBranch = async (input: CreateBranchInput) => {
    setCreating(true);
    showToast("Grafting scion + masking PII…");
    try {
      const branch = await api.createBranch(input);
      setModalOpen(false);
      showToast(`Branch growing: ${branch.gitBranch}`);
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to create branch");
    } finally {
      setCreating(false);
    }
  };

  const teardownId = async (id: string) => {
    showToast("Pruning branch…");
    try {
      await api.teardown(id);
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to prune");
    }
  };

  const teardown = (b: BranchView) => teardownId(b.id);

  const reset = async (b: BranchView) => {
    showToast(`Re-cloning ${b.gitBranch} from prod…`);
    try {
      await api.resetBranch(b.id);
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to reset");
    }
  };

  const explore = async (b: BranchView) => {
    setActiveLabel(b.prNumber ? `pr-${b.prNumber}` : b.gitBranch);
    setActiveBranch(b);
    try {
      setMaskedData(await api.maskedData(b.id));
    } catch {
      setMaskedData(null);
    }
  };

  const deployAction = async (
    id: string,
    action: "apply" | "revert" | "reject",
    confirm = false,
  ) => {
    setApplying(true);
    try {
      await api.deployAction(id, action, confirm);
      showToast(
        action === "apply"
          ? "Migration applied"
          : action === "revert"
            ? "Migration reverted"
            : "Deploy request rejected",
      );
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Action failed");
    } finally {
      setApplying(false);
    }
  };

  const copy = async () => {
    const host = activeBranch?.connectionHost;
    if (!host) {
      showToast("Explore a ready branch first");
      return;
    }
    try {
      await navigator.clipboard.writeText(
        `postgres://scion:****@${host}:5432/shop`,
      );
    } catch {
      /* clipboard may be unavailable */
    }
    showToast("Connection string copied");
  };

  return (
    <>
      <main className="mx-auto w-full max-w-7xl px-6 py-9">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-ink">
              Preview branches
            </h1>
            <p className="mt-2 text-sm text-ink-muted">
              One isolated, PII-masked database per PR — provisioned on demand,
              pruned on close.
            </p>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            style={{ boxShadow: "0 8px 24px -8px rgba(44,122,55,0.5)" }}
            className="inline-flex items-center gap-2 rounded-lg bg-leaf px-5 py-3 text-sm font-bold text-white transition hover:bg-leaf-deep"
          >
            <Plus className="h-4 w-4" /> Grow branch
          </button>
        </div>

        <StatCards stats={stats} />
        <LineageTree
          goldens={goldens}
          branches={branches}
          loading={!loaded}
          onOpen={(b) => setDetailId(b.id)}
        />
        <section id="branches" className="scroll-mt-28">
          <BranchTable
            branches={branches}
            loading={!loaded}
            onOpen={(b) => setDetailId(b.id)}
            onExplore={explore}
            onReset={reset}
            onTeardown={teardown}
          />
        </section>

        <div id="deploy-requests" className="grid scroll-mt-28 gap-6 lg:grid-cols-2">
          <DeployRequestCard
            dr={dr}
            busy={applying}
            loading={!loaded && !dr}
            onAction={deployAction}
          />
          <MaskedDataCard
            data={maskedData}
            branchLabel={activeLabel}
            host={activeBranch?.connectionHost ?? null}
            onCopy={copy}
          />
        </div>

        <footer className="mt-10 border-t border-line pt-5 text-xs text-ink-faint">
          Scion — database branches on Amazon Aurora copy-on-write
        </footer>
      </main>

      <div
        className={`pointer-events-none fixed bottom-5 right-5 z-50 rounded-lg border border-line bg-ink px-4 py-2.5 text-sm text-paper shadow-2xl transition-all duration-300 ${
          toast ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        }`}
      >
        {toast}
      </div>

      <NewBranchModal
        open={modalOpen}
        submitting={creating}
        onClose={() => setModalOpen(false)}
        onSubmit={createBranch}
      />
      <BranchDetailDrawer
        branchId={detailId}
        onClose={() => setDetailId(null)}
        onTeardown={teardownId}
        onToast={showToast}
      />
    </>
  );
}
