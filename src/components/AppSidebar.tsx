import { Link, useLocation } from "@tanstack/react-router";
import { CalendarDays, Users, Wallet, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", label: "Rota", icon: CalendarDays },
  { to: "/employees", label: "Employees", icon: Users },
  { to: "/budget", label: "Yearly Budget", icon: Wallet },
];

export function AppSidebar() {
  const loc = useLocation();
  return (
    <aside className="w-60 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground flex flex-col">
      <div className="px-5 h-16 flex items-center gap-2 border-b border-sidebar-border">
        <div className="size-8 rounded-md bg-primary/15 ring-1 ring-primary/40 flex items-center justify-center">
          <LayoutGrid className="size-4 text-primary" />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Scheduling</p>
          <p className="text-sm font-semibold">Cockpit</p>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {items.map((item) => {
          const active = loc.pathname === item.to;
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-sidebar-border">
        <div className="rounded-lg bg-primary/10 border border-primary/20 p-3">
          <p className="text-[10px] uppercase tracking-widest text-primary font-semibold">Live</p>
          <p className="text-xs text-muted-foreground mt-1">Optimising for cost efficiency</p>
        </div>
      </div>
    </aside>
  );
}
