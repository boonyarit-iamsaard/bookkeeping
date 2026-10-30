import type { ErrorComponentProps } from "@tanstack/react-router";
import { useRouter } from "@tanstack/react-router";
import { CloudOff } from "lucide-react";
import { Button } from "@/shared/components/ui/button";

interface LoadErrorProps extends Pick<ErrorComponentProps, "reset"> {
  title: string;
  message: string;
  /** Ways out beside Try again, such as the screen's logical parent. */
  actions?: React.ReactNode;
}

/**
 * A screen whose reads failed, in the screen's own words. Try again reloads
 * the same address, so whatever it names is kept.
 */
export function LoadError({
  reset,
  title,
  message,
  actions,
}: Readonly<LoadErrorProps>) {
  const router = useRouter();
  function retry() {
    reset();
    void router.invalidate();
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col px-4 py-6 sm:py-8">
      <div className="bg-card shadow-card flex flex-col items-start gap-4 rounded-2xl p-5 sm:p-7">
        <span className="bg-destructive/10 text-destructive flex size-12 items-center justify-center rounded-lg">
          <CloudOff aria-hidden="true" strokeWidth={2} className="size-6" />
        </span>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p role="alert" className="text-muted-foreground max-w-prose text-sm">
            {message}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={retry} size="lg">
            Try again
          </Button>
          {actions}
        </div>
      </div>
    </main>
  );
}
