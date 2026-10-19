import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { SignInPrompt } from "~/components/sign-in-prompt";
import { StatusBadge } from "~/components/status-badge";
import { TeacherAvatar } from "~/components/teacher-avatar";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "~/components/ui/dialog";
import { errorMessage } from "~/lib/errors";
import { formatDayLong, formatTime, TIME_ZONE_NOTE } from "~/lib/format";
import { cn } from "~/lib/utils";
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/mis-clases")({
	head: () => ({ meta: [{ title: "Mis clases · Aula IA" }] }),
	loader: async ({ context }) => {
		if (!context.isAuthenticated) return;
		await context.queryClient.query({
			...myBookingsQuery,
			staleTime: "static",
		});
	},
	component: MyClassesPage,
});

const myBookingsQuery = convexQuery(api.bookings.listMine, {});

type Booking = FunctionReturnType<typeof api.bookings.listMine>[number];

function MyClassesPage() {
	const { isAuthenticated } = Route.useRouteContext();

	if (!isAuthenticated) {
		return (
			<div className="mx-auto max-w-3xl sm:py-6">
				<SignInPrompt
					title="Iniciá sesión para ver tus clases"
					description="Acá vas a encontrar las clases que reservaste."
					redirect="/mis-clases"
				/>
			</div>
		);
	}

	return <MyClasses />;
}

function MyClasses() {
	const { data: bookings } = useSuspenseQuery(myBookingsQuery);

	return (
		<div className="mx-auto max-w-3xl sm:py-6">
			<h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
				Mis clases
			</h1>
			<p className="mt-1 text-sm text-muted-foreground">
				Tus próximas clases. {TIME_ZONE_NOTE}.
			</p>

			<div className="mt-8">
				{bookings.length === 0 ? (
					<section className="rounded-xl border border-dashed px-6 py-12 text-center">
						<h2 className="font-medium">Todavía no tenés clases reservadas</h2>
						<p className="mt-1 text-muted-foreground">
							Elegí un profesor y reservá tu primera clase.
						</p>
						<Button asChild className="mt-6">
							<Link to="/">Ver profesores</Link>
						</Button>
					</section>
				) : (
					<ul className="grid gap-3">
						{bookings.map((booking) => (
							<li key={booking._id}>
								<BookingItem booking={booking} />
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}

function BookingItem({ booking }: { booking: Booking }) {
	const cancelled = booking.status === "cancelled";

	return (
		<article
			className={cn(
				"flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-start",
				cancelled && "bg-muted/40 text-muted-foreground",
			)}
		>
			<TeacherAvatar
				name={booking.teacher.name}
				photoUrl={booking.teacher.photoUrl}
				className={cn(cancelled && "opacity-60")}
			/>
			<div className="min-w-0 flex-1">
				<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
					<h2
						className={cn(
							"font-medium first-letter:uppercase",
							cancelled && "line-through decoration-1",
						)}
					>
						{formatDayLong(booking.startsAt)}, {formatTime(booking.startsAt)}
					</h2>
					<StatusBadge status={booking.status} />
				</div>
				<p className="mt-0.5 text-sm">
					con{" "}
					<Link
						to="/profesores/$slug"
						params={{ slug: booking.teacher.slug }}
						className="font-medium underline-offset-4 hover:underline"
					>
						{booking.teacher.name}
					</Link>{" "}
					<span className="text-muted-foreground">
						({booking.durationMin} min)
					</span>
				</p>
				<p className="mt-3 line-clamp-3 text-sm break-words text-muted-foreground">
					{booking.topic}
				</p>
			</div>
			{!cancelled && <CancelBookingButton booking={booking} />}
		</article>
	);
}

function CancelBookingButton({ booking }: { booking: Booking }) {
	const [open, setOpen] = useState(false);
	// Blocks a second click that lands before React re-renders (e.g. a double click).
	const sending = useRef(false);
	const cancel = useMutation({
		// Convex applies this to its local store at once and drops it when the server
		// answers, so on error the card goes back to "Confirmada" by itself.
		mutationFn: useConvexMutation(api.bookings.cancel).withOptimisticUpdate(
			(store, { bookingId }) => {
				const list = store.getQuery(api.bookings.listMine, {});
				if (list) {
					store.setQuery(
						api.bookings.listMine,
						{},
						list.map((b) =>
							b._id === bookingId ? { ...b, status: "cancelled" as const } : b,
						),
					);
				}
				const one = store.getQuery(api.bookings.get, { bookingId });
				if (one) {
					store.setQuery(
						api.bookings.get,
						{ bookingId },
						{ ...one, status: "cancelled" },
					);
				}
			},
		),
		// retry stays 0: Convex resends on reconnect and retries OCC; errors here are business errors.
		onSuccess: () => toast.success("Clase cancelada"),
		onError: (err) => toast.error(errorMessage(err)),
		onSettled: () => {
			sending.current = false;
		},
	});

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					className="self-start"
					disabled={cancel.isPending}
					aria-label={`Cancelar la clase del ${formatDayLong(booking.startsAt)} a las ${formatTime(booking.startsAt)}`}
				>
					Cancelar
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>¿Cancelar la clase?</DialogTitle>
					<DialogDescription>
						Vas a cancelar la clase con {booking.teacher.name} del{" "}
						{formatDayLong(booking.startsAt)} a las{" "}
						{formatTime(booking.startsAt)}. El horario vuelve a quedar libre
						para otros estudiantes.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<DialogClose asChild>
						<Button variant="outline">Volver</Button>
					</DialogClose>
					<Button
						variant="destructive"
						onClick={() => {
							setOpen(false);
							if (sending.current) return;
							sending.current = true;
							cancel.mutate({ bookingId: booking._id });
						}}
					>
						Cancelar clase
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
