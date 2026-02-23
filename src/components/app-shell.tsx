import { Link, NavLink } from "react-router-dom";
import { Waves, Fish, ShipWheel, Settings as SettingsIcon, Compass, MapPinned } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "How To", icon: MapPinned, end: true, hideOnMobile: true },
  { to: "/dashboard", label: "Dashboard", icon: Compass, end: true },
  { to: "/conditions", label: "Conditions", icon: Waves },
  { to: "/bite", label: "Bite", icon: Fish },
  { to: "/charters", label: "Charters", icon: ShipWheel },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-app-pattern text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/85 backdrop-blur-lg">
        <div className="container flex items-center justify-between py-2.5 sm:py-3">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <div className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-cyan-400 to-emerald-500 sm:h-10 sm:w-10" aria-hidden />
            <div className="min-w-0">
              <p className="truncate text-base font-semibold tracking-tight sm:text-lg">Cabo Marlin Ops</p>
              <p className="hidden text-xs text-muted-foreground sm:block">Trip window: Mar 20-23, 2026</p>
            </div>
          </Link>

          <nav className="hidden gap-1 md:flex" aria-label="Primary">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors",
                    isActive && "bg-primary/20 text-primary",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="container py-4 pb-28 sm:py-6 sm:pb-6">{children}</main>

      <nav className="fixed bottom-3 left-1/2 z-20 flex w-[96%] max-w-xl -translate-x-1/2 items-center justify-between rounded-2xl border border-border/70 bg-background/95 px-1.5 py-1.5 shadow-xl backdrop-blur md:hidden" style={{ paddingBottom: "max(0.375rem, env(safe-area-inset-bottom))" }}>
        {navItems.filter((item) => !item.hideOnMobile).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center rounded-lg px-1 py-1 text-[10px] leading-tight text-muted-foreground",
                isActive && "bg-primary/15 text-primary",
              )
            }
          >
            <item.icon className="h-4 w-4" aria-hidden />
            <span className="mt-0.5 truncate">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
