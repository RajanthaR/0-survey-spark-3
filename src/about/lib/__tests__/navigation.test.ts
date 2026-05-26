import { describe, expect, it } from "vitest";

import { buildAboutBreadcrumbs } from "@/about/lib/navigation";
import { getAboutSectionForPath } from "@/about/lib/sections";

describe("about navigation helpers", () => {
  it("detects the active section from the pathname", () => {
    expect(getAboutSectionForPath("/about/research")?.id).toBe("research");
    expect(getAboutSectionForPath("/about")).toBeUndefined();
  });

  it("builds hub breadcrumbs", () => {
    expect(buildAboutBreadcrumbs({ pathname: "/about" })).toEqual([{ label: "About" }]);
  });

  it("builds lane breadcrumbs", () => {
    expect(buildAboutBreadcrumbs({ pathname: "/about/study" })).toEqual([
      { label: "About", href: "/about" },
      { label: "Study", href: undefined },
    ]);
  });

  it("builds document breadcrumbs", () => {
    expect(
      buildAboutBreadcrumbs({ pathname: "/about/engineering", docTitle: "Deployment" }),
    ).toEqual([
      { label: "About", href: "/about" },
      { label: "Engineering", href: "/about/engineering" },
      { label: "Deployment" },
    ]);
  });
});
