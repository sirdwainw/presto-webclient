import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { LoadingBlock } from "../components/LoadingBlock";

export function ProtectedRoute() {
  const { isAuthed, isInitializing } = useAuth();
  const loc = useLocation();

  if (isInitializing) return <LoadingBlock title="Loading session..." />;

  if (!isAuthed) {
    return <Navigate to="/login" replace state={{ from: loc }} />;
  }

  return <Outlet />;
}
