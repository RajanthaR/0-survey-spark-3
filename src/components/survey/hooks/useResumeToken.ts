import { useEffect, useState } from "react";

import { clearStoredResumeToken, setStoredResumeToken } from "@/lib/resume-token-storage";

export function useResumeToken(slug: string, initialToken?: string) {
  const [token, setToken] = useState<string | undefined>(initialToken);

  useEffect(() => {
    if (token && typeof window !== "undefined") {
      setStoredResumeToken(slug, token);
    }
  }, [slug, token]);

  return {
    token,
    persist: setToken,
    clear: () => {
      setToken(undefined);
      clearStoredResumeToken(slug);
    },
  };
}
