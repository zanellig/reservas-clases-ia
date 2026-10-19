import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useConvexAuth } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { LoaderCircleIcon } from "lucide-react";
import { useState } from "react";
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
import { Skeleton } from "~/components/ui/skeleton";
import { errorMessage } from "~/lib/errors";
import { formatDayLong, formatTime, TIME_ZONE_NOTE } from "~/lib/format";
import { cn } from "~/lib/utils";
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/mis-clases")({
	head: () => ({ meta: [{ title: "Mis clases · Aula IA" }] }),
	component: MyClassesPage,
});

type Booking = FunctionReturnType<typeof api.bookings.listMine>[number];

function MyClassesPage() {
	const auth = useConvexAuth();
	const bookings = useQuery(
		convexQuery(api.bookings.listMine, auth.isAuthenticated ? {} : "skip"),
	);

	if (!auth.isLoading && !auth.isAuthenticated) {
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

	return (
		<div className="mx-auto max-w-3xl sm:py-6">
			<h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
				Mis clases
			</h1>
			<p className="mt-1 text-sm text-muted-foreground">
				Tus próximas clases. {TIME_ZONE_NOTE}.
			</p>

			<div className="mt-8">
				{bookings.isError ? (
					<p role="alert" className="text-destructive">
						{errorMessage(bookings.error)}
					</p>
				) : !bookings.data ? (
					<div
						className="grid gap-3"
						role="status"
						aria-busy="true"
						aria-label="Cargando clases"
					>
						<Skeleton className="h-28 w-full rounded-xl" />
						<Skeleton className="h-28 w-full rounded-xl" />
					</div>
				) : bookings.data.length === 0 ? (
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
						{bookings.data.map((booking) => (
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
	const cancel = useMutation({
		mutationFn: useConvexMutation(api.bookings.cancel),
		onSuccess: () => {
			setOpen(false);
			toast.success("Clase cancelada");
		},
		onError: (err) => toast.error(errorMessage(err)),
	});

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => !cancel.isPending && setOpen(next)}
		>
			<DialogTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					className="self-start"
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
						<Button variant="outline" disabled={cancel.isPending}>
							Volver
						</Button>
					</DialogClose>
					<Button
						variant="destructive"
						disabled={cancel.isPending}
						onClick={() => cancel.mutate({ bookingId: booking._id })}
					>
						{cancel.isPending && (
							<LoaderCircleIcon
								data-icon="inline-start"
								className="animate-spin"
								aria-hidden
							/>
						)}
						{cancel.isPending ? "Cancelando…" : "Cancelar clase"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
