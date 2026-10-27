"use client";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { api } from "../lib/api";
import { clearToken, type Role } from "../lib/auth";
import { unreadFor, type Message } from "./Conversation";
import { BodyIcon, CameraIcon, HandIcon, HomeIcon, Logo, LogoutIcon, ProfileIcon, ReportIcon, StethoscopeIcon } from "./Icons";

interface NavItem {
  href: string;
  label: string;
  icon: (p: { className?: string }) => ReactNode;
  badge?: "unread" | "pending";
}

const NAV: Record<Role, NavItem[]> = {
  patient: [
    { href: "/patient", label: "Home", icon: HomeIcon },
    { href: "/patient/body", label: "Describe a problem", icon: BodyIcon },
    { href: "/patient/reports", label: "Reports & messages", icon: ReportIcon, badge: "unread" },
    { href: "/patient/profile", label: "My medical info", icon: ProfileIcon },
    { href: "/patient/detect", label: "Sign detection", icon: CameraIcon },
    { href: "/patient/teach", label: "Teach MedHear", icon: HandIcon },
  ],
  doctor: [{ href: "/doctor/dashboard", label: "Patient reports", icon: StethoscopeIcon, badge: "pending" }],
};

const ROLE_LABEL: Record<Role, string> = { patient: "Patient", doctor: "Healthcare professional" };
const POLL_MS = 10000;

// Shared frame for signed-in pages: sidebar on large screens, a top bar with tabs on small ones.
export default function AppShell({ role, children, wide = false }: { role: Role; children: ReactNode; wide?: boolean }) {
  const pathname = usePathname();
  const [counts, setCounts] = useState({ unread: 0, pending: 0 });

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        if (role === "patient") {
          const reports = await api<{ messages: Message[] }[]>("/reports/mine");
          if (alive) setCounts((c) => ({ ...c, unread: reports.reduce((n, r) => n + unreadFor(r.messages, "patient"), 0) }));
        } else {
          const reports = await api<{ status: string }[]>("/reports");
          if (alive) setCounts((c) => ({ ...c, pending: reports.filter((r) => r.status === "pending").length }));
        }
      } catch {
        // badges are a convenience; the pages themselves report errors
      }
    }
    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [role]);

  function logOut() {
    clearToken(role);
    if (role === "patient") sessionStorage.removeItem("medhear_body_parts");
    window.location.href = `/${role}/login`;
  }

  const items = NAV[role];
  const isActive = (href: string) => (href === "/patient" ? pathname === href : pathname === href || pathname.startsWith(href + "/"));
  const badgeOf = (item: NavItem) => (item.badge === "unread" ? counts.unread : item.badge === "pending" ? counts.pending : 0);

  return (
    <div className="min-h-screen bg-paper lg:flex">
      {/* sidebar (large screens) */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 lg:sticky lg:top-0 lg:h-screen bg-white border-r border-gray-200 px-4 py-6">
        <a href="/" className="px-2 mb-8">
          <Logo />
        </a>
        <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">{ROLE_LABEL[role]}</p>
        <nav className="flex flex-col gap-1">
          {items.map((item) => {
            const active = isActive(item.href);
            const badge = badgeOf(item);
            return (
              <a
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                  active ? "bg-sky text-brand-deep" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                {item.icon({ className: "w-5 h-5 shrink-0" })}
                <span className="flex-1">{item.label}</span>
                {badge > 0 && <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-xs font-bold">{badge}</span>}
              </a>
            );
          })}
        </nav>
        <div className="mt-auto">
          <p className="px-3 mb-3 text-xs leading-relaxed text-gray-400">
            MedHear is an assistive tool, not a diagnosis. A healthcare professional always confirms.
          </p>
          <button
            onClick={logOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition"
          >
            <LogoutIcon className="w-5 h-5" /> Log out
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        {/* top bar + tabs (small screens) */}
        <header className="lg:hidden sticky top-0 z-20 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between px-4 h-14">
            <a href="/">
              <Logo />
            </a>
            <button onClick={logOut} className="flex items-center gap-1.5 text-sm font-semibold text-gray-600" aria-label="Log out">
              <LogoutIcon className="w-5 h-5" /> Log out
            </button>
          </div>
          {items.length > 1 && (
            <nav className="flex gap-2 overflow-x-auto px-4 pb-3">
              {items.map((item) => {
                const active = isActive(item.href);
                const badge = badgeOf(item);
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-semibold ${
                      active ? "bg-brand text-white" : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {item.label}
                    {badge > 0 && <span className="px-1.5 rounded-full bg-red-600 text-white text-xs">{badge}</span>}
                  </a>
                );
              })}
            </nav>
          )}
        </header>

        <main className={`mx-auto w-full px-5 sm:px-8 py-8 lg:py-10 ${wide ? "max-w-5xl" : "max-w-3xl"}`}>{children}</main>
      </div>
    </div>
  );
}

// Consistent page title block used at the top of every shell page.
export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 mb-7">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">{title}</h1>
        {subtitle && <p className="text-gray-500 mt-1.5 max-w-xl">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
