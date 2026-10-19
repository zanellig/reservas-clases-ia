/// <reference types="vite/client" />

import {
	type AuthClient,
	ConvexBetterAuthProvider,
} from "@convex-dev/better-auth/react";
import type { ConvexQueryClient } from "@convex-dev/react-query";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	type ErrorComponentProps,
	HeadContent,
	Link,
	Outlet,
	Scripts,
	useRouteContext,
	useRouter,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type * as React from "react";
import { SiteHeader } from "~/components/site-header";
import { Button } from "~/components/ui/button";
import { Toaster } from "~/components/ui/sonner";
import { authClient } from "~/lib/auth-client";
import { getToken } from "~/lib/auth-server";
import appCss from "~/styles/app.css?url";

// Reads the Better Auth session cookie on the server and returns a Convex JWT.
const getAuth = createServerFn({ method: "GET" }).handler(async () => {
	return await getToken();
});

// In the browser the session only changes on sign-in/sign-out, and both do a
// full page load, so ask the server once per page load, not on every navigation.
// ponytail: a session that expires mid-visit still reads as signed in until reload.
let clientAuth: ReturnType<typeof getAuth> | undefined;

export const Route = createRootRouteWithContext<{
	queryClient: QueryClient;
	convexQueryClient: ConvexQueryClient;
}>()({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Aula IA · Clases de IA" },
		],
		links: [
			{ rel: "stylesheet", href: appCss },
			{
				rel: "apple-touch-icon",
				sizes: "180x180",
				href: "/apple-touch-icon.png",
			},
			{
				rel: "icon",
				type: "image/png",
				sizes: "32x32",
				href: "/favicon-32x32.png",
			},
			{
				rel: "icon",
				type: "image/png",
				sizes: "16x16",
				href: "/favicon-16x16.png",
			},
			{ rel: "manifest", href: "/site.webmanifest" },
			{ rel: "icon", href: "/favicon.ico", sizes: "48x48" },
			{ rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
		],
	}),
	beforeLoad: async ({ context }) => {
		const token = await (typeof window === "undefined"
			? getAuth()
			: (clientAuth ??= getAuth()));
		// During SSR only (serverHttpClient exists only there), authenticate
		// TanStack Query's Convex HTTP queries with the session's token.
		if (token) context.convexQueryClient.serverHttpClient?.setAuth(token);
		return { isAuthenticated: !!token, token };
	},
	notFoundComponent: NotFoundPage,
	component: RootComponent,
});

function RootComponent() {
	const context = useRouteContext({ from: Route.id });
	return (
		<ConvexBetterAuthProvider
			client={context.convexQueryClient.convexClient}
			// ponytail: cast because the component's AuthClient type (built on better-auth 1.6.15)
			// rejects 1.6.33's client under TS 7; runtime is fine. Drop when the component catches up.
			authClient={authClient as unknown as AuthClient}
			initialToken={context.token}
		>
			<RootDocument>
				<SiteHeader />
				<main className="mx-auto max-w-5xl px-4 py-8">
					<Outlet />
				</main>
				<Toaster />
			</RootDocument>
		</ConvexBetterAuthProvider>
	);
}

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="es">
			<head>
				<HeadContent />
			</head>
			<body className="min-h-screen bg-background text-foreground antialiased">
				{children}
				<Scripts />
			</body>
		</html>
	);
}

function Fallback(props: {
	title: string;
	message: string;
	children?: React.ReactNode;
}) {
	return (
		<div className="flex flex-col items-center gap-3 py-16 text-center">
			<h1 className="text-xl font-semibold">{props.title}</h1>
			<p className="text-sm text-muted-foreground">{props.message}</p>
			<div className="flex gap-2">
				{props.children}
				<Button variant="outline" asChild>
					<Link to="/">Ir al inicio</Link>
				</Button>
			</div>
		</div>
	);
}

export function NotFoundPage() {
	return (
		<Fallback
			title="Página no encontrada"
			message="La página que buscás no existe."
		/>
	);
}

export function ErrorPage({ error, reset }: ErrorComponentProps) {
	const router = useRouter();
	console.error(error);
	return (
		<Fallback
			title="Algo salió mal"
			message="Ocurrió un error inesperado. Probá de nuevo."
		>
			<Button
				onClick={() => {
					reset();
					router.invalidate();
				}}
			>
				Reintentar
			</Button>
		</Fallback>
	);
}
