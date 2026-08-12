import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HeroVisual } from "@/components/marketing/hero-visual";

describe("reduced motion", () => {
  it("renders the transformation story as static content when motion is reduced", () => {
    const original = window.matchMedia;
    window.matchMedia = (query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    });

    render(<HeroVisual />);
    expect(
      screen.getByRole("img", {
        name: /Rough work fragments move through three workflow lanes/i,
      }),
    ).toHaveAttribute("data-motion", "preference-aware");
    window.matchMedia = original;
  });
});
