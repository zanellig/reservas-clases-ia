import { Link } from "@tanstack/react-router";
import { GraduationCap, LogIn, LogOut } from "lucide-react";
import { Button } from "~/components/ui/button";
import { authClient } from "~/lib/auth-client";

const navLink =
	"text-sm text-muted-foreground transition-colors hover:text-foreground data-[status=active]:font-medium data-[status=active]:text-foreground";

export function SiteHeader() {
	const { data: session, isPending } = authClient.useSession();

	async function signOut() {
		await authClient.signOut();
		// Full reload, as the Better Auth guide recommends with expectAuth: true.
		window.location.assign("/");
	}

	return (
		<header className="border-b">
			<div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4">
				<Link to="/" className="flex items-center gap-2 font-semibold">
					<GraduationCap className="size-5" />
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
					{isPending ? null : session ? (
						<>
							<span className="hidden text-sm text-muted-foreground sm:inline">
								{session.user.name}
							</span>
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
