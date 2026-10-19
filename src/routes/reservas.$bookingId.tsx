import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useConvexAuth } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { CircleCheckIcon } from "lucide-react";
import { SignInPrompt } from "~/components/sign-in-prompt";
import { StatusBadge } from "~/components/status-badge";
import { TeacherAvatar } from "~/components/teacher-avatar";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { formatDayLong, formatTime } from "~/lib/format";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export const Route = createFileRoute("/reservas/$bookingId")({
	head: () => ({ meta: [{ title: "Tu reserva · Aula IA" }] }),
	component: BookingPage,
});

function BookingPage() {
	const { bookingId } = Route.useParams();
	const auth = useConvexAuth();
	const booking = useQuery(
		convexQuery(
			api.bookings.get,
			auth.isAuthenticated
				? { bookingId: bookingId as Id<"bookings"> }
				: "skip",
		),
	);

	return (
		<div className="mx-auto max-w-xl sm:py-6">
			{auth.isLoading || (auth.isAuthenticated && booking.isPending) ? (
				<BookingSkeleton />
			) : !auth.isAuthenticated ? (
				<SignInPrompt
					title="Iniciá sesión para ver tu reserva"
					description="Las reservas solo las puede ver quien las hizo."
					redirect={`/reservas/${bookingId}`}
				/>
			) : // A malformed id makes the query throw; treat it like a missing booking.
			booking.isError || !booking.data ? (
				<BookingNotFound />
			) : (
				<BookingDetails booking={booking.data} />
			)}
		</div>
	);
}

type Booking = NonNullable<FunctionReturnType<typeof api.bookings.get>>;

function BookingDetails({ booking }: { booking: Booking }) {
	const confirmed = booking.status === "confirmed";
	const day = formatDayLong(booking.startsAt);
	const time = formatTime(booking.startsAt);

	return (
		<article>
			{confirmed && (
				<CircleCheckIcon
					className="size-10 text-emerald-600"
					strokeWidth={1.75}
					aria-hidden
				/>
			)}
			<h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
				{confirmed ? "¡Reserva confirmada!" : "Reserva cancelada"}
			</h1>
			<p className="mt-2 text-muted-foreground">
				{confirmed
					? `Te esperamos el ${day} a las ${time} con ${booking.teacher.name}.`
					: `Cancelaste la clase del ${day} con ${booking.teacher.name}.`}
			</p>

			<div className="mt-8 rounded-xl border">
				<div className="flex items-center gap-3 border-b p-4">
					<TeacherAvatar
						name={booking.teacher.name}
						photoUrl={booking.teacher.photoUrl}
					/>
					<div className="min-w-0">
						<Link
							to="/profesores/$slug"
							params={{ slug: booking.teacher.slug }}
							className="font-medium underline-offset-4 hover:underline"
						>
							{booking.teacher.name}
						</Link>
						<p className="text-sm text-muted-foreground">
							{booking.teacher.headline}
						</p>
					</div>
				</div>
				<dl className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-3 p-4 text-sm">
					<dt className="text-muted-foreground">Día</dt>
					<dd className="first-letter:uppercase">{day}</dd>
					<dt className="text-muted-foreground">Hora</dt>
					<dd>{time} (hora de Argentina)</dd>
					<dt className="text-muted-foreground">Duración</dt>
					<dd>{booking.durationMin} minutos</dd>
					<dt className="text-muted-foreground">Tema</dt>
					<dd className="break-words whitespace-pre-line">{booking.topic}</dd>
					<dt className="text-muted-foreground">Estado</dt>
					<dd>
						<StatusBadge status={booking.status} />
					</dd>
				</dl>
			</div>

			<div className="mt-8 flex flex-col gap-2 sm:flex-row">
				<Button asChild size="lg">
					<Link to="/mis-clases">Ver mis clases</Link>
				</Button>
				<Button asChild size="lg" variant="outline">
					<Link to="/">Reservar otra clase</Link>
				</Button>
			</div>
		</article>
	);
}

function BookingSkeleton() {
	return (
		<div
			className="grid gap-4"
			role="status"
			aria-busy="true"
			aria-label="Cargando reserva"
		>
			<Skeleton className="h-8 w-2/3" />
			<Skeleton className="h-5 w-full" />
			<Skeleton className="mt-4 h-64 w-full rounded-xl" />
		</div>
	);
}

function BookingNotFound() {
	return (
		<section className="text-center">
			<h1 className="text-xl font-semibold tracking-tight">
				No encontramos esta reserva
			</h1>
			<p className="mt-2 text-muted-foreground">
				Puede que el enlace esté mal o que la reserva sea de otra cuenta.
			</p>
			<Button asChild className="mt-6">
				<Link to="/mis-clases">Ver mis clases</Link>
			</Button>
		</section>
	);
}
