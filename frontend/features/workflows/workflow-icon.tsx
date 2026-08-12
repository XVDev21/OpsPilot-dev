import { Bug, ClipboardCheck, ListTodo } from "lucide-react";
import type { WorkflowIconName } from "@/features/workflows/types";
import { cn } from "@/lib/utils";

const icons = {
  bug: Bug,
  meeting: ListTodo,
  status: ClipboardCheck,
} satisfies Record<WorkflowIconName, typeof Bug>;

export function WorkflowIcon({
  name,
  className,
}: {
  name: WorkflowIconName;
  className?: string;
}) {
  const Icon = icons[name];
  return <Icon aria-hidden="true" className={cn("size-5", className)} strokeWidth={1.8} />;
}
