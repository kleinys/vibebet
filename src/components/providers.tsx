"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Toaster } from "sonner";
import { useState, type ReactNode, memo } from "react";

const ProvidersComponent = ({ children }: { children: ReactNode }) => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1, // Reduce retries to improve perceived performance
            gcTime: 5 * 60 * 1000, // Keep cache for 5 minutes
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster theme="dark" position="top-center" richColors />
      {process.env.NODE_ENV !== "production" && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
};

export const Providers = memo(ProvidersComponent);

// Add display name for better debugging
Providers.displayName = 'Providers';