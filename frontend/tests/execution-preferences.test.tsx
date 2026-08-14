import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import {
  AppModeProvider,
  useAppMode,
} from "@/components/providers/app-mode-provider";

function PreferenceProbe() {
  const { provider, setProvider, intelligence, setIntelligence } = useAppMode();
  return (
    <div>
      <output>{`${provider}:${intelligence}`}</output>
      <button type="button" onClick={() => setProvider("openai")}>Use OpenAI</button>
      <button type="button" onClick={() => setIntelligence("high")}>Use Deep</button>
    </div>
  );
}

afterEach(() => window.localStorage.clear());

describe("execution preferences", () => {
  it("defaults to the efficient Gemini route and persists explicit choices", async () => {
    const user = userEvent.setup();
    render(
      <AppModeProvider>
        <PreferenceProbe />
      </AppModeProvider>,
    );

    expect(screen.getByText("gemini:fast")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Use OpenAI" }));
    await user.click(screen.getByRole("button", { name: "Use Deep" }));

    expect(screen.getByText("openai:high")).toBeInTheDocument();
    expect(window.localStorage.getItem("opspilot:provider:v1")).toBe("openai");
    expect(window.localStorage.getItem("opspilot:intelligence:v1")).toBe("high");
  });
});
