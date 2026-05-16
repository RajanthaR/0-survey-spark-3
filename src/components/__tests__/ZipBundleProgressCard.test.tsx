import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  ZipBundleProgressCard,
  type ZipBundleProgress,
} from "../admin/ZipBundleProgressCard";

const base: ZipBundleProgress = {
  phase: "preparing",
  surveyCount: null,
  totalRows: null,
  filename: null,
};

describe("ZipBundleProgressCard", () => {
  it("renders the preparing frame at step 1/3 with 33%", () => {
    render(<ZipBundleProgressCard progress={base} />);
    expect(screen.getByText("Preparing CSVs…")).toBeInTheDocument();
    expect(screen.getByText(/Step 1 \/ 3 · 33%/)).toBeInTheDocument();
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "33");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
    expect(screen.getByTestId("zip-bundle-meta")).toHaveTextContent("Counting…");
  });

  it("advances to zipping at step 2/3 with 67% and shows survey/row meta", () => {
    render(
      <ZipBundleProgressCard
        progress={{
          phase: "zipping",
          surveyCount: 4,
          totalRows: 1234,
          filename: "eip-insight-bundle.zip",
        }}
      />,
    );
    expect(screen.getByText("Zipping bundle…")).toBeInTheDocument();
    expect(screen.getByText(/Step 2 \/ 3 · 67%/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "67");
    const meta = screen.getByTestId("zip-bundle-meta");
    expect(meta).toHaveTextContent("4 surveys · 1,234 rows");
    expect(meta).toHaveTextContent("eip-insight-bundle.zip");
  });

  it("pins at 100% on downloading", () => {
    render(
      <ZipBundleProgressCard
        progress={{
          phase: "downloading",
          surveyCount: 1,
          totalRows: 1,
          filename: "a.zip",
        }}
      />,
    );
    expect(screen.getByText("Triggering download…")).toBeInTheDocument();
    expect(screen.getByText(/Step 3 \/ 3 · 100%/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    // Singular noun forms when counts are 1.
    expect(screen.getByTestId("zip-bundle-meta")).toHaveTextContent(
      "1 survey · 1 row",
    );
  });

  it("uses role='status' + aria-live='polite' so SR users hear updates", () => {
    const { container } = render(<ZipBundleProgressCard progress={base} />);
    const card = container.querySelector("#zip-bundle-progress");
    expect(card).not.toBeNull();
    expect(card).toHaveAttribute("role", "status");
    expect(card).toHaveAttribute("aria-live", "polite");
  });
});
