import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import {
  applySecurityHeaders,
  createCspNonce,
  readInitialLang,
} from "@/lib/security-headers.server";

const securityMiddleware = createMiddleware().server(async ({ next, request }) => {
  const nonce = createCspNonce();
  const initialLang = readInitialLang(request.headers.get("cookie"));
  const result = await next({ context: { nonce, initialLang } });
  applySecurityHeaders(result.response.headers, nonce);
  return result;
});

const errorMiddleware = createMiddleware().server(async ({ next, request }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(readInitialLang(request.headers.get("cookie"))), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  requestMiddleware: [securityMiddleware, errorMiddleware],
  functionMiddleware: [attachSupabaseAuth],
}));
