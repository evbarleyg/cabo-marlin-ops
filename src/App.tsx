import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/app-shell";
import { BiteRoute } from "@/routes/bite";
import { ChartersRoute } from "@/routes/charters";
import { ConditionsRoute } from "@/routes/conditions";
import { DashboardRoute } from "@/routes/dashboard";
import { NotFoundRoute } from "@/routes/not-found";
import { SettingsRoute } from "@/routes/settings";

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<DashboardRoute />} />
        <Route path="/conditions" element={<ConditionsRoute />} />
        <Route path="/bite" element={<BiteRoute />} />
        <Route path="/charters" element={<ChartersRoute />} />
        <Route path="/settings" element={<SettingsRoute />} />
        <Route path="/index.html" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFoundRoute />} />
      </Routes>
    </AppShell>
  );
}
