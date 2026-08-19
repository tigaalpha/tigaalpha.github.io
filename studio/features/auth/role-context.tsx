"use client";

import { createContext, useContext } from "react";
import type { UserRole } from "@/types/database";

/** null while the role is still loading (see AuthGuard) — treat as "not yet known," not "no role." */
const RoleContext = createContext<UserRole | null>(null);

export const RoleProvider = RoleContext.Provider;

export function useUserRole(): UserRole | null {
  return useContext(RoleContext);
}
