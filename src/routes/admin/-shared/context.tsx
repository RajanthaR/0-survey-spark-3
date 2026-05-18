import { createContext, useContext } from "react";

const AdminSessionContext = createContext<{ email: string } | null>(null);

export const AdminSessionProvider = AdminSessionContext.Provider;

export function useAdminSession() {
  const session = useContext(AdminSessionContext);
  if (!session) throw new Error("useAdminSession must be used under /admin");
  return session;
}
