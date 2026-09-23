import type { ErrorComponentProps } from "@tanstack/react-router";
import { useRouter } from "@tanstack/react-router";
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
    <main className="mx-auto flex w-full max-w-2xl flex-col items-start gap-4 px-4 py-8">
      <h1 className="font-semibold text-2xl tracking-tight">{title}</h1>
      <p role="alert" className="text-muted-foreground text-sm">
        {message}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={retry} size="lg">
          Try again
        </Button>
        {actions}
      </div>
    </main>
  );
}
