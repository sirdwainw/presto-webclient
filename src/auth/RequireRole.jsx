import React from "react";
import { useAuth } from "./AuthContext";
import { Forbidden } from "../components/Forbidden";

export function RequireRole({ roles, children }) {
  const { user } = useAuth();
  const role = user?.role;

  if (!role || !roles.includes(role)) {
    return <Forbidden allowed={roles} role={role} />;
  }
  return children;
}
