import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/app-shell";

const BiteRoute = lazy(() => import("@/routes/bite").then((module) => ({ default: module.BiteRoute })));
const ChartersRoute = lazy(() => import("@/routes/charters").then((module) => ({ default: module.ChartersRoute })));
const ConditionsRoute = lazy(() => import("@/routes/conditions").then((module) => ({ default: module.ConditionsRoute })));
const DashboardRoute = lazy(() => import("@/routes/dashboard").then((module) => ({ default: module.DashboardRoute })));
const HowToRoute = lazy(() => import("@/routes/how-to").then((module) => ({ default: module.HowToRoute })));
const NotFoundRoute = lazy(() => import("@/routes/not-found").then((module) => ({ default: module.NotFoundRoute })));
const SettingsRoute = lazy(() => import("@/routes/settings").then((module) => ({ default: module.SettingsRoute })));

function RouteFallback() {
  return <div className="rounded-md border border-border/50 bg-card p-3 text-sm text-muted-foreground">Loading view...</div>;
}

export default function App() {
  return (
    <AppShell>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<HowToRoute />} />
          <Route path="/dashboard" element={<DashboardRoute />} />
          <Route path="/conditions" element={<ConditionsRoute />} />
          <Route path="/bite" element={<BiteRoute />} />
          <Route path="/charters" element={<ChartersRoute />} />
          <Route path="/settings" element={<SettingsRoute />} />
          <Route path="/index.html" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<NotFoundRoute />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}
