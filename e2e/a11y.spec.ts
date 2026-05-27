import { expect, test } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";

const ROUTES = (
  process.env.AXE_PATHS ??
  "/,/s/phase-1,/admin,/about,/about/study,/about/research,/about/engineering,/about/present"
)
  .split(",")
  .map((path) => path.trim())
  .filter(Boolean);

function violationSummary(violations: Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"]) {
  return violations
    .map((violation) => {
      const nodes = violation.nodes
        .slice(0, 3)
        .map((node) => node.target.join(" "))
        .join("; ");
      return `${violation.id}: ${violation.help} (${nodes})`;
    })
    .join("\n");
}

test.describe("critical route accessibility", () => {
  for (const route of ROUTES) {
    test(`${route} has no axe violations`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState("networkidle").catch(() => undefined);

      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();

      expect(results.violations, violationSummary(results.violations)).toEqual([]);
    });
  }
});
