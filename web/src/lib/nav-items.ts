import { LayoutDashboard, Compass, ListChecks, Send, Radar, BarChart3, FileText, Files, Settings, CalendarClock } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

// Single source of truth for the app's primary destinations — shared by the
// desktop sidebar and the mobile nav so they can never drift.
export type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  chip?: string;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/explore", label: "Find jobs", icon: Compass, chip: "New" },
  { href: "/scheduled-scans", label: "Job alerts", icon: CalendarClock },
  { href: "/pipeline", label: "My applications", icon: ListChecks },
  { href: "/followups", label: "Follow-ups", icon: Send },
  { href: "/portals", label: "Companies", icon: Radar },
  { href: "/analytics", label: "Insights", icon: BarChart3 },
  { href: "/cv", label: "Résumé", icon: FileText },
  { href: "/documents", label: "Files", icon: Files },
  { href: "/config", label: "Settings", icon: Settings },
];

// Needs a computer that stays on and an OS scheduler, so a hosted deployment omits it.
const LOCAL_ONLY = new Set(["/scheduled-scans"]);

export function visibleNavItems(followupsEnabled: boolean, hosted = false): NavItem[] {
  return NAV_ITEMS.filter((item) => (followupsEnabled || item.href !== "/followups") && !(hosted && LOCAL_ONLY.has(item.href)));
}

export function isActivePath(href: string, pathname: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
