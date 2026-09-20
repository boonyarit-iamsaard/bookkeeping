import { QueryClientProvider } from "@tanstack/react-query";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { createQueryClient } from "@/core/query/query-client";
import { AppHeader } from "@/core/shell/app-header";

const queryClient = createQueryClient();

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppHeader />
      <Outlet />
    </QueryClientProvider>
  );
}
