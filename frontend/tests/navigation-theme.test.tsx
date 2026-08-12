import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/layout/app-shell";
import { SiteHeader } from "@/components/layout/site-header";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ThemeSelector } from "@/components/theme/theme-selector";

vi.mock("next/navigation", () => ({
  usePathname: () => "/app",
}));

describe("navigation and themes", () => {
  it("exposes only implemented app navigation", () => {
    render(
      <AppShell>
        <p>Workspace content</p>
      </AppShell>,
    );
    expect(screen.getAllByRole("link", { name: /Overview/i })[0]).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getAllByRole("link", { name: /Workflows/i }).length).toBeGreaterThan(0);
    expect(screen.queryByText("History")).not.toBeInTheDocument();
    expect(screen.queryByText("Settings")).not.toBeInTheDocument();
  });

  it("opens the accessible mobile site navigation", async () => {
    const user = userEvent.setup();
    render(<SiteHeader />);
    await user.click(screen.getByRole("button", { name: "Open navigation" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Mobile navigation" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Enter Demo Mode" })).toHaveAttribute("href", "/app");
  });

  it("switches between light, dark, and system themes", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <ThemeSelector />
      </ThemeProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Dark" }));
    await waitFor(() => expect(document.documentElement.classList.contains("dark")).toBe(true));
    await user.click(screen.getByRole("button", { name: "Light" }));
    await waitFor(() => expect(document.documentElement.classList.contains("light")).toBe(true));
    await user.click(screen.getByRole("button", { name: "System" }));
    expect(screen.getByRole("button", { name: "System" })).toHaveAttribute("aria-pressed", "true");
  });
});
