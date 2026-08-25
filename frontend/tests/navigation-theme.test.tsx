import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/layout/app-shell";
import { AppModeProvider } from "@/components/providers/app-mode-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { SiteHeader } from "@/components/layout/site-header";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ThemeSelector } from "@/components/theme/theme-selector";

vi.mock("next/navigation", () => ({
  usePathname: () => "/app",
}));

vi.mock("@/app/app/actions", () => ({
  signOutAction: vi.fn(),
  switchWorkspaceAction: vi.fn(),
}));

const appUser = {
  id: "user_1",
  email: "alex@example.com",
  displayName: "Alex Rivera",
  firstName: "Alex",
  lastName: "Rivera",
  avatarUrl: null,
  initials: "AR",
};

describe("navigation and themes", () => {
  it("exposes only implemented app navigation", () => {
    render(
      <QueryProvider>
        <AppModeProvider>
          <AppShell user={appUser}>
            <p>Workspace content</p>
          </AppShell>
        </AppModeProvider>
      </QueryProvider>,
    );
    expect(screen.getAllByRole("link", { name: /Overview/i })[0]).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getAllByRole("link", { name: /Cases/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: /^Workflows$/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Work Status/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: /History/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Settings/i }).length).toBeGreaterThan(0);
  });

  it("opens the accessible mobile site navigation", async () => {
    const user = userEvent.setup();
    render(<SiteHeader />);
    await user.click(screen.getByRole("button", { name: "Open navigation" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Mobile navigation" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Enter Demo Mode" })).toHaveAttribute("href", "/demo");
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
