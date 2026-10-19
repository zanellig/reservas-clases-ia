import { createFileRoute, redirect } from "@tanstack/react-router";
import { AlertCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { authClient } from "~/lib/auth-client";

// Only same-origin paths: '/x' is fine; '//evil.com' and '/\evil.com' are not.
const safePath = (value: unknown) =>
	typeof value === "string" && /^\/(?![/\\])/.test(value) ? value : undefined;

export const Route = createFileRoute("/login")({
	validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
		redirect: safePath(search.redirect),
	}),
	beforeLoad: ({ context, search }) => {
		if (context.isAuthenticated)
			throw redirect({ href: search.redirect ?? "/" });
	},
	head: () => ({ meta: [{ title: "Ingresar · Aula IA" }] }),
	component: LoginPage,
});

const errorMessages: Record<string, string> = {
	INVALID_EMAIL_OR_PASSWORD: "Email o contraseña incorrectos.",
	USER_ALREADY_EXISTS: "Ya existe una cuenta con ese email. Ingresá.",
	USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
		"Ya existe una cuenta con ese email. Ingresá.",
};

function LoginPage() {
	const { redirect: target } = Route.useSearch();
	const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);
	const isSignUp = mode === "sign-up";

	async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		const email = String(form.get("email"));
		const password = String(form.get("password"));
		setPending(true);
		setError(null);
		const { error } = isSignUp
			? await authClient.signUp.email({
					name: String(form.get("name")),
					email,
					password,
				})
			: await authClient.signIn.email({ email, password });
		if (error) {
			setError(
				errorMessages[error.code ?? ""] ??
					"No pudimos completar la operación. Probá de nuevo.",
			);
			setPending(false);
			return;
		}
		// ponytail: full navigation so SSR and the Convex client both start with the new
		// session (the guide's advice for expectAuth: true). Use router.navigate if it ever matters.
		window.location.assign(target ?? "/");
	}

	return (
		<div className="mx-auto max-w-sm">
			<Card>
				<CardHeader>
					<CardTitle>{isSignUp ? "Crear cuenta" : "Ingresar"}</CardTitle>
					<CardDescription>
						{isSignUp
							? "Registrate para reservar clases con profesores de IA."
							: "Ingresá para reservar y ver tus clases."}
					</CardDescription>
				</CardHeader>
				<form onSubmit={onSubmit}>
					<CardContent className="flex flex-col gap-4">
						{error && (
							<Alert variant="destructive">
								<AlertCircle />
								<AlertDescription>{error}</AlertDescription>
							</Alert>
						)}
						{isSignUp && (
							<div className="flex flex-col gap-2">
								<Label htmlFor="name">Nombre</Label>
								<Input id="name" name="name" autoComplete="name" required />
							</div>
						)}
						<div className="flex flex-col gap-2">
							<Label htmlFor="email">Email</Label>
							<Input
								id="email"
								name="email"
								type="email"
								autoComplete="email"
								required
							/>
						</div>
						<div className="flex flex-col gap-2">
							<Label htmlFor="password">Contraseña</Label>
							<Input
								id="password"
								name="password"
								type="password"
								autoComplete={isSignUp ? "new-password" : "current-password"}
								minLength={8}
								required
							/>
						</div>
					</CardContent>
					<CardFooter className="mt-6 flex flex-col gap-2">
						<Button type="submit" className="w-full" disabled={pending}>
							{pending && <Loader2 className="animate-spin" />}
							{isSignUp ? "Crear cuenta" : "Ingresar"}
						</Button>
						<Button
							type="button"
							variant="link"
							size="sm"
							onClick={() => {
								setMode(isSignUp ? "sign-in" : "sign-up");
								setError(null);
							}}
						>
							{isSignUp
								? "¿Ya tenés cuenta? Ingresá"
								: "¿No tenés cuenta? Registrate"}
						</Button>
					</CardFooter>
				</form>
			</Card>
		</div>
	);
}
