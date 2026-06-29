"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  GitBranch,
  GitPullRequest,
  Menu,
  Settings,
  X,
  type LucideIcon,
} from "lucide-react";
import { ScionMark } from "./scion-mark";

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Branches", icon: GitBranch },
  { href: "/deploy-requests", label: "Deploy Requests", icon: GitPullRequest },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [provisioner, setProvisioner] = useState<string>("mock");

  useEffect(() => {
    setCollapsed(localStorage.getItem("scion.collapsed") === "1");
  }, []);

  // Read the provisioner mode (mock vs live AWS) for the footer indicator.
  useEffect(() => {
    fetch("/api/connections")
      .then((r) => r.json())
      .then((d) => setProvisioner(d?.provisioner ?? "mock"))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const toggleCollapsed = () =>
    setCollapsed((c) => {
      localStorage.setItem("scion.collapsed", c ? "0" : "1");
      return !c;
    });

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const hideLabel = collapsed ? "md:hidden" : "";

  return (
    <div className="flex min-h-screen">
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-ink/40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-surface transition-transform md:sticky md:top-0 md:z-auto md:h-screen md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "md:w-16" : "md:w-60"}`}
      >
        <div className="flex h-16 shrink-0 items-center gap-2.5 px-4">
          <ScionMark className="h-7 w-7 shrink-0 text-leaf" />
          <span
            className={`text-xl font-bold tracking-tight text-ink ${hideLabel}`}
          >
            Scion
          </span>
          <button
            onClick={() => setMobileOpen(false)}
            className="ml-auto rounded-md p-1.5 text-ink-faint hover:bg-raised hover:text-ink md:hidden"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-2">
          {NAV.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-leaf/10 text-leaf"
                    : "text-ink-muted hover:bg-raised hover:text-ink"
                } ${collapsed ? "md:justify-center md:px-2" : ""}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className={hideLabel}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="space-y-1 border-t border-line p-2">
          <div
            className={`flex items-center gap-2 rounded-lg px-3 py-2 font-mono text-xs ${
              collapsed ? "md:justify-center md:px-2" : ""
            }`}
            title={
              provisioner === "aws"
                ? "Live AWS provisioning"
                : "Mock provisioning — branches are simulated"
            }
          >
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                provisioner === "aws" ? "bg-leaf" : "bg-amber"
              }`}
            />
            <span className={hideLabel}>
              <span className="text-ink-faint">mode</span>{" "}
              {provisioner === "aws" ? (
                <span className="text-leaf">AWS · live</span>
              ) : (
                <span className="text-amber">mock</span>
              )}
            </span>
          </div>
          <button
            onClick={toggleCollapsed}
            className={`hidden w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-muted transition hover:bg-raised hover:text-ink md:flex ${
              collapsed ? "md:justify-center md:px-2" : ""
            }`}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4 shrink-0" />
            ) : (
              <ChevronLeft className="h-4 w-4 shrink-0" />
            )}
            <span className={hideLabel}>Collapse</span>
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 items-center gap-3 border-b border-line bg-paper/80 px-4 backdrop-blur md:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-1.5 text-ink-muted hover:bg-raised hover:text-ink"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <ScionMark className="h-6 w-6 text-leaf" />
          <span className="font-bold tracking-tight text-ink">Scion</span>
        </div>
        {children}
      </div>
    </div>
  );
}
