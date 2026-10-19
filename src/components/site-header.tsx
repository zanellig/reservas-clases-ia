import { Link, useRouteContext } from "@tanstack/react-router";
import { LogIn, LogOut } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { authClient } from "~/lib/auth-client";

const navLink =
	"whitespace-nowrap text-sm text-muted-foreground transition-colors hover:text-foreground data-[status=active]:font-medium data-[status=active]:text-foreground";

export function SiteHeader() {
	// Known on the server (root beforeLoad), so the right button is in the SSR HTML.
	const { isAuthenticated } = useRouteContext({ from: "__root__" });
	const { data: session } = authClient.useSession();

	async function signOut() {
		await authClient.signOut();
		// Full reload, as the Better Auth guide recommends with expectAuth: true.
		window.location.assign("/");
	}

	return (
		<header className="border-b">
			<div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4 sm:gap-6">
				<Link
					to="/"
					className="flex shrink-0 items-center gap-2 whitespace-nowrap font-semibold"
				>
					<img src="/favicon.svg" alt="" className="size-6" />
					Aula IA
				</Link>
				<nav className="flex items-center gap-4">
					<Link to="/" className={navLink} activeOptions={{ exact: true }}>
						Profesores
					</Link>
					<Link to="/mis-clases" className={navLink}>
						Mis clases
					</Link>
				</nav>
				<div className="ml-auto flex items-center gap-3">
					{isAuthenticated ? (
						<>
							{session ? (
								<span className="hidden text-sm text-muted-foreground sm:inline">
									{session.user.name}
								</span>
							) : (
								<Skeleton className="hidden h-4 w-24 sm:block" />
							)}
							<Button variant="ghost" size="sm" onClick={signOut}>
								<LogOut />
								Salir
							</Button>
						</>
					) : (
						<Button size="sm" asChild>
							<Link to="/login">
								<LogIn />
								Ingresar
							</Link>
						</Button>
					)}
				</div>
			</div>
		</header>
	);
}
