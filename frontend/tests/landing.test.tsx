import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";

describe("landing page", () => {
  it("renders the final product promise and all workflow launches", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { name: "Stop rewriting the same AI prompts." }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Bug / Issue Triage").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Meeting → Action Items").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Work → Status Update").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /Try the workflows/i })).toHaveAttribute(
      "href",
      "/demo/workflows",
    );
  });
});
