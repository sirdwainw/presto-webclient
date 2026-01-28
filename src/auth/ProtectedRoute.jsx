import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { LoadingBlock } from "../components/LoadingBlock";

export function ProtectedRoute({ children }) {
  const { isAuthed, isInitializing } = useAuth();
  const loc = useLocation();

  if (isInitializing) return <LoadingBlock title="Loading session..." />;

  if (!isAuthed) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }
  return children;
}
