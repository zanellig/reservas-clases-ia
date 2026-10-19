import { ConvexQueryClient } from "@convex-dev/react-query";
import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { ErrorPage, NotFoundPage } from "./routes/__root";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
	const CONVEX_URL = import.meta.env.VITE_CONVEX_URL;
	if (!CONVEX_URL) {
		console.error("missing envar CONVEX_URL");
	}
	// expectAuth: Convex functions wait for the auth token on first load (Better Auth guide).
	const convexQueryClient = new ConvexQueryClient(CONVEX_URL, {
		expectAuth: true,
	});

	const queryClient: QueryClient = new QueryClient({
		defaultOptions: {
			queries: {
				queryKeyHashFn: convexQueryClient.hashFn(),
				queryFn: convexQueryClient.queryFn(),
				// Keep hover-preloaded data (and its Convex subscription) until the click.
				gcTime: 60_000,
			},
		},
	});
	convexQueryClient.connect(queryClient);

	// ConvexBetterAuthProvider lives in __root.tsx, as in the Better Auth guide.
	const router = createRouter({
		routeTree,
		defaultPreload: "intent",
		context: { queryClient, convexQueryClient },
		scrollRestoration: true,
		defaultPreloadStaleTime: 0, // Let React Query handle all caching
		defaultErrorComponent: ErrorPage,
		defaultNotFoundComponent: NotFoundPage,
	});
	// Dehydrates SSR query data and wraps the app in QueryClientProvider.
	setupRouterSsrQueryIntegration({ router, queryClient });

	return router;
}
