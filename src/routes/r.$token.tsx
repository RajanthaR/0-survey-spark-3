import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";

import { resumeResponse } from "@/lib/responses.functions";

export const Route = createFileRoute("/r/$token")({
  component: ResumePage,
});

function ResumePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const resumeFn = useServerFn(resumeResponse);

  useEffect(() => {
    let cancelled = false;
    resumeFn({ data: { resumeToken: token } })
      .then((row) => {
        if (cancelled) return;
        if (!row) {
          navigate({ to: "/" });
          return;
        }
        navigate({
          to: "/s/$slug",
          params: { slug: row.surveySlug },
          search: { token },
          replace: true,
        });
      })
      .catch(() => navigate({ to: "/" }));
    return () => {
      cancelled = true;
    };
  }, [token, resumeFn, navigate]);

  return (
    <div className="grid min-h-screen place-items-center">
      <Loader2 className="size-6 animate-spin text-primary" />
    </div>
  );
}
