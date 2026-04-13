"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Upload,
  BarChart3,
  TrendingUp,
  Calendar,
  FileText,
  DollarSign,
  Plug,
  LogOut,
  Mail,
  Workflow,
  Receipt,
} from "lucide-react";

const globalNav = [
  { label: "Clients", href: "/clients", icon: Users },
  { label: "Finance", href: "/finance", icon: DollarSign },
];

interface SidebarProps {
  clientId?: string;
  clientName?: string;
}

export function Sidebar({ clientId, clientName }: SidebarProps) {
  const pathname = usePathname();

  const clientNav = clientId
    ? [
        { label: "Dashboard", href: `/clients/${clientId}/dashboard`, icon: BarChart3 },
        { label: "Analytics", href: `/clients/${clientId}/analytics`, icon: TrendingUp },
        { label: "Campaigns", href: `/clients/${clientId}/campaigns`, icon: Mail },
        { label: "Flows", href: `/clients/${clientId}/flows`, icon: Workflow },
        { label: "Finance", href: `/clients/${clientId}/finance`, icon: Receipt },
        { label: "Uploads", href: `/clients/${clientId}/uploads`, icon: Upload },
        { label: "Calendar", href: `/clients/${clientId}/calendar`, icon: Calendar },
        { label: "Briefs", href: `/clients/${clientId}/briefs`, icon: FileText },
        { label: "Integrations", href: `/clients/${clientId}/integrations`, icon: Plug },
      ]
    : [];

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-56 flex-col border-r border-taupe-light bg-white/40 backdrop-blur-sm">
      {/* Brand */}
      <div className="flex h-14 items-center px-5">
        <Link href="/clients" className="text-xs font-semibold uppercase tracking-[0.2em] text-charcoal">
          KDC CRM OS
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        {/* Global */}
        <nav className="space-y-0.5">
          {globalNav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors",
                  active
                    ? "bg-taupe-light text-charcoal"
                    : "text-taupe-dark hover:bg-taupe-light/60 hover:text-charcoal"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Client context */}
        {clientId && (
          <>
            <div className="mt-6 mb-2 px-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-taupe">
                Client
              </p>
              <p className="mt-0.5 truncate text-sm font-medium text-charcoal">
                {clientName || "—"}
              </p>
            </div>
            <nav className="space-y-0.5">
              {clientNav.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors",
                      active
                        ? "bg-taupe-light text-charcoal"
                        : "text-taupe-dark hover:bg-taupe-light/60 hover:text-charcoal"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-taupe-light p-3">
        <form action="/api/auth/signout" method="post">
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium text-taupe-dark transition-colors hover:bg-taupe-light/60 hover:text-charcoal"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
