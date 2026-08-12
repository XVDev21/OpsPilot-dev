import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main-content" className="page-container grid min-h-dvh place-items-center py-16">
      <div className="max-w-lg text-center">
        <p className="font-mono text-sm font-bold text-primary">404</p>
        <h1 className="mt-4 text-4xl font-bold tracking-[-0.04em] text-foreground">That workflow is off the map.</h1>
        <p className="mt-4 text-base leading-7 text-foreground-muted">
          OpsPilot currently includes three focused workflows. Return to the catalog to choose one.
        </p>
        <Button asChild className="mt-7">
          <Link href="/app/workflows"><ArrowLeft aria-hidden="true" className="size-4" /> Back to workflows</Link>
        </Button>
      </div>
    </main>
  );
}
