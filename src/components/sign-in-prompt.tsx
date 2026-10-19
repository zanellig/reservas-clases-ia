import { Link } from "@tanstack/react-router";
import { LogInIcon } from "lucide-react";
import { Button } from "~/components/ui/button";

export function SignInPrompt({
	title,
	description,
	redirect,
}: {
	title: string;
	description: string;
	redirect: string;
}) {
	return (
		<section className="mx-auto max-w-md rounded-xl border bg-card px-6 py-10 text-center">
			<h1 className="text-xl font-semibold tracking-tight">{title}</h1>
			<p className="mt-2 text-muted-foreground">{description}</p>
			<Button asChild size="lg" className="mt-6">
				<Link to="/login" search={{ redirect }}>
					<LogInIcon data-icon="inline-start" aria-hidden />
					Iniciar sesión
				</Link>
			</Button>
		</section>
	);
}
