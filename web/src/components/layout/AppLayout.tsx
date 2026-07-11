import {
  ArrowLeftRight,
  CalendarClock,
  FileBarChart,
  LayoutDashboard,
  LineChart,
  LogOut,
  Moon,
  PiggyBank,
  Sun,
  Tags,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/transactions", label: "Transactions", icon: ArrowLeftRight, end: false },
  { to: "/recurring", label: "Recurring", icon: CalendarClock, end: false },
  { to: "/budgets", label: "Budgets", icon: PiggyBank, end: false },
  { to: "/reports", label: "P&L Report", icon: FileBarChart, end: false },
  { to: "/cashflow", label: "Cash Flow", icon: TrendingUp, end: false },
  { to: "/insights", label: "Insights", icon: LineChart, end: false },
  { to: "/accounts", label: "Accounts", icon: Wallet, end: false },
  { to: "/categories", label: "Categories", icon: Tags, end: false },
];

function useDarkMode() {
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem("ft_theme");
    if (stored) return stored === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("ft_theme", dark ? "dark" : "light");
  }, [dark]);
  return { dark, toggle: () => setDark((d) => !d) };
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const { dark, toggle } = useDarkMode();

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-card md:flex">
        <div className="flex h-16 items-center gap-2 border-b px-6">
          <span className="text-2xl">💰</span>
          <span className="text-lg font-semibold">Finance Tracker</span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t p-3 text-xs text-muted-foreground">Phase 1 · MVP</div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b bg-card px-4 md:px-6">
          {/* Mobile nav */}
          <nav className="flex gap-1 overflow-x-auto md:hidden">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "rounded-md p-2",
                    isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                  )
                }
                title={item.label}
              >
                <item.icon className="h-5 w-5" />
              </NavLink>
            ))}
          </nav>
          <div className="hidden md:block" />
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
              {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium leading-tight">{user?.name}</div>
              <div className="text-xs text-muted-foreground">{user?.email}</div>
            </div>
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
