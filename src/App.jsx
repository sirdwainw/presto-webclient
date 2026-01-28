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
import { ProfilePage } from "./pages/ProfilePage.jsx";
import { SuperadminContextPage } from "./pages/SuperadminContextPage.jsx";
import { NotFoundPage } from "./pages/NotFoundPage.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* public */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* protected */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />

        <Route path="/meters" element={<MetersPage />} />
        <Route path="/meters/:id" element={<MeterDetailPage />} />
        <Route path="/meters/:id/updates" element={<MeterUpdatesPage />} />

        <Route
          path="/review/updates"
          element={
            <RequireRole roles={["admin", "superadmin"]}>
              <ReviewUpdatesPage />
            </RequireRole>
          }
        />

        <Route
          path="/reports"
          element={
            <RequireRole roles={["admin", "superadmin"]}>
              <ReportsPage />
            </RequireRole>
          }
        />

        <Route
          path="/tech/assignments"
          element={
            <RequireRole roles={["tech"]}>
              <TechAssignmentsPage />
            </RequireRole>
          }
        />

        <Route path="/profile" element={<ProfilePage />} />

        <Route
          path="/superadmin/context"
          element={
            <RequireRole roles={["superadmin"]}>
              <SuperadminContextPage />
            </RequireRole>
          }
        />

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
