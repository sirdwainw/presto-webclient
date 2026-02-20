import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { ProtectedRoute } from "./auth/ProtectedRoute.jsx";
import { RequireRole } from "./auth/RequireRole.jsx";

import { AppLayout } from "./components/AppLayout.jsx";

import { LoginPage } from "./pages/LoginPage.jsx";
import { RegisterPage } from "./pages/RegisterPage.jsx";
import { DashboardPage } from "./pages/DashboardPage.jsx";
import { MetersPage } from "./pages/MetersPage.jsx";
import { MeterDetailPage } from "./pages/MeterDetailPage.jsx";
import { MeterUpdatesPage } from "./pages/MeterUpdatesPage.jsx";
import { ReviewUpdatesPage } from "./pages/ReviewUpdatesPage.jsx";
import { ReportsPage } from "./pages/ReportsPage.jsx";
import { TechAssignmentsPage } from "./pages/TechAssignmentsPage.jsx";
import { TechUpdatesPage } from "./pages/TechUpdatesPage.jsx";
import { UpdateDetailPage } from "./pages/UpdateDetailPage.jsx";

import { AdminAssignmentsPage } from "./pages/AdminAssignmentsPage.jsx";
import { NotFoundPage } from "./pages/NotFoundPage.jsx";
import Settings from "./pages/Settings.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />

          <Route path="/meters" element={<MetersPage />} />
          <Route path="/meters/:id" element={<MeterDetailPage />} />
          <Route path="/meters/:id/updates" element={<MeterUpdatesPage />} />
          <Route path="/updates/:id" element={<UpdateDetailPage />} />

          <Route path="/settings" element={<Settings />} />
          <Route
            path="/profile"
            element={<Navigate to="/settings" replace />}
          />

          <Route element={<RequireRole roles={["admin", "superadmin"]} />}>
            <Route path="/assignments" element={<AdminAssignmentsPage />} />
            <Route path="/review/updates" element={<ReviewUpdatesPage />} />
            <Route path="/reports" element={<ReportsPage />} />
          </Route>

          <Route element={<RequireRole roles={["tech"]} />}>
            <Route path="/tech/assignments" element={<TechAssignmentsPage />} />
            <Route path="/tech/updates" element={<TechUpdatesPage />} />
          </Route>

          <Route element={<RequireRole roles={["superadmin"]} />}>
            <Route
              path="/superadmin/context"
              element={<Navigate to="/settings" replace />}
            />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
