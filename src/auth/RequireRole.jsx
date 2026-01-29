import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function RequireRole({ roles }) {
  const { user, isInitializing } = useAuth();

  // optional: if still initializing, don't decide yet
  if (isInitializing) return null;

  const role = user?.role;

  if (!role || !roles?.includes(role)) {
    // send them somewhere safe 
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
