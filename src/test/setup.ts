/**
 * Global Vitest setup for component tests.
 *
 * - Registers `@testing-library/jest-dom` custom matchers
 *   (`toBeInTheDocument`, `toHaveTextContent`, `toHaveAttribute`, …) on
 *   Vitest's `expect` so React Testing Library assertions read naturally
 *   and produce far better failure messages than bare `toBeTruthy()`.
 * - Auto-runs `cleanup()` after every test so successive `render()` calls
 *   don't leak DOM between cases (Vitest does NOT call this for us in v4).
 *
 * Wired into `vitest.config.ts` via `test.setupFiles`. The jsdom environment
 * is configured globally there as well, so this file just layers the
 * matchers + cleanup on top.
 */
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

// jsdom doesn't implement Element.scrollIntoView (used by QuestionView when
// the heading mounts). Stub it out so component tests don't crash.
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}
