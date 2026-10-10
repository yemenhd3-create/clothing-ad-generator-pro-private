import { trpc } from "@/lib/trpc";
import { COOKIE_NAME, UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { startLogin } from "./const";
import "./index.css";

const queryClient = new QueryClient();

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  startLogin();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

function getTrpcBaseUrl(): string {
  // In development mode (Vite dev server), use relative path to allow Vite proxying
  if (import.meta.env.DEV) {
    return "/api/trpc";
  }

  // In Capacitor APK / mobile WebView or standalone local file
  if (
    typeof window !== "undefined" &&
    (window.location.protocol === "capacitor:" ||
      window.location.protocol === "ionic:" ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1")
  ) {
    const remoteUrl = import.meta.env.VITE_API_URL || "https://production-v2-0-0.onrender.com";
    return `${remoteUrl.replace(/\/$/, "")}/api/trpc`;
  }

  return "/api/trpc";
}

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: getTrpcBaseUrl(),
      transformer: superjson,
      headers() {
        const headers: Record<string, string> = {};

        // 1. Developer session token (for mobile APK & cross-origin WebView)
        try {
          const devToken = localStorage.getItem("clothing_ad_developer_token");
          if (devToken) {
            headers["x-developer-session"] = devToken;
          }
        } catch {}

        // 2. User session token (saved permanently in localStorage across app restarts)
        try {
          const userToken = localStorage.getItem("clothing_ad_user_token");
          if (userToken) {
            headers["Authorization"] = `Bearer ${userToken}`;
            return headers;
          }

          const raw = sessionStorage.getItem("manus-cookie");
          if (raw) {
            const prefix = `${COOKIE_NAME}=`;
            const pair = raw.split(";").find(s => s.trim().startsWith(prefix));
            const token = pair?.trim().slice(prefix.length);
            if (token) {
              headers["Authorization"] = `Bearer ${token}`;
              return headers;
            }
          }
        } catch {}

        return headers;
      },
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
