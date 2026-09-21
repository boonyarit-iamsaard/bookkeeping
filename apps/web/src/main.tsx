import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { apiClient } from "@/core/api/client";
import { createUnauthenticatedMiddleware } from "@/core/api/unauthenticated-middleware";
import { resetSessionCache } from "@/core/auth/session";
import { createQueryClient } from "@/core/query/query-client";
import { createAppRouter } from "@/core/router/router";
import "@/styles/fonts.css";
import "@/styles/globals.css";

const container = document.getElementById("root");
if (!container) {
  throw new Error("The document has no #root element to mount into");
}

const queryClient = createQueryClient();
const router = createAppRouter({ queryClient });

// The cookie is the real check: an API refusal ends the client's session too.
apiClient.use(
  createUnauthenticatedMiddleware({
    onUnauthenticated() {
      resetSessionCache(queryClient);
      void router.navigate({ to: "/sign-in", replace: true });
    },
  }),
);

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
