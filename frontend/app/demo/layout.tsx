import { DemoShell } from "@/components/layout/demo-shell";

export default function PublicDemoLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <DemoShell>{children}</DemoShell>;
}
