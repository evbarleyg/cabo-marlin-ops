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
        <div className="container flex items-center justify-between py-3">
          <Link to="/" className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-cyan-400 to-emerald-500" aria-hidden />
            <div>
              <p className="text-lg font-semibold tracking-tight">Cabo Marlin Ops</p>
              <p className="text-xs text-muted-foreground">Trip window: Mar 20-23, 2026</p>
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

      <main className="container py-6">{children}</main>

      <nav className="fixed bottom-4 left-1/2 z-20 flex w-[95%] max-w-lg -translate-x-1/2 items-center justify-around rounded-2xl border border-border/70 bg-background/90 p-2 shadow-xl backdrop-blur md:hidden">
        {navItems.filter((item) => !item.hideOnMobile).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center rounded-lg px-2 py-1 text-[11px] text-muted-foreground",
                isActive && "bg-primary/15 text-primary",
              )
            }
          >
            <item.icon className="h-4 w-4" aria-hidden />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
