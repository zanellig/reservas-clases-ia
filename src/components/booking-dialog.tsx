import { useConvexMutation } from "@convex-dev/react-query";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useConvexAuth } from "convex/react";
import { AlertCircleIcon, LoaderCircleIcon } from "lucide-react";
import type { FormEvent } from "react";
import { useId, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { errorMessage } from "~/lib/errors";
import { formatDayLong, formatTime } from "~/lib/format";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { TOPIC_MAX_LENGTH, TOPIC_MIN_LENGTH } from "../../convex/lib/constants";

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	teacher: { name: string; slug: string };
	slot: { _id: Id<"slots">; startsAt: number; durationMin: number };
	/** Live availability, so the dialog reacts if someone else takes the slot. */
	available: boolean;
};

export function BookingDialog({ open, onOpenChange, ...props }: Props) {
	const { isLoading, isAuthenticated } = useConvexAuth();

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				{isLoading ? (
					<DialogHeader>
						<DialogTitle>Reservar clase</DialogTitle>
						<DialogDescription className="flex items-center gap-2">
							<LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
							Cargando…
						</DialogDescription>
					</DialogHeader>
				) : isAuthenticated ? (
					<BookingForm {...props} />
				) : (
					<SignInStep {...props} />
				)}
			</DialogContent>
		</Dialog>
	);
}

type StepProps = Omit<Props, "open" | "onOpenChange">;

function SignInStep({ teacher, slot }: StepProps) {
	return (
		<>
			<DialogHeader>
				<DialogTitle>Iniciá sesión para reservar</DialogTitle>
				<DialogDescription>
					Para reservar la clase con {teacher.name} del{" "}
					{formatDayLong(slot.startsAt)} a las {formatTime(slot.startsAt)}{" "}
					necesitás entrar con tu cuenta. Después volvés a esta página.
				</DialogDescription>
			</DialogHeader>
			<DialogFooter>
				<DialogClose asChild>
					<Button variant="outline">Volver</Button>
				</DialogClose>
				<Button asChild>
					<Link
						to="/login"
						search={{ redirect: `/profesores/${teacher.slug}` }}
					>
						Iniciar sesión
					</Link>
				</Button>
			</DialogFooter>
		</>
	);
}

function validateTopic(topic: string) {
	const length = topic.trim().length;
	if (length === 0) return "Contanos qué querés trabajar en la clase.";
	if (length < TOPIC_MIN_LENGTH)
		return `Escribí al menos ${TOPIC_MIN_LENGTH} caracteres.`;
	if (length > TOPIC_MAX_LENGTH)
		return `Usá como máximo ${TOPIC_MAX_LENGTH} caracteres.`;
	return null;
}

function BookingForm({ teacher, slot, available }: StepProps) {
	const navigate = useNavigate();
	const ids = useId();
	const [topic, setTopic] = useState("");
	const [submitted, setSubmitted] = useState(false);
	const create = useMutation({
		mutationFn: useConvexMutation(api.bookings.create),
	});

	const topicError = submitted ? validateTopic(topic) : null;
	// Our own booking also flips `available`; don't flash a warning while it lands.
	const slotGone = !available && !create.isPending && !create.isSuccess;
	const busy = create.isPending || create.isSuccess;

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSubmitted(true);
		if (validateTopic(topic) || slotGone) return;
		create.mutate(
			{ slotId: slot._id, topic: topic.trim() },
			{
				onSuccess: (bookingId) =>
					navigate({ to: "/reservas/$bookingId", params: { bookingId } }),
			},
		);
	}

	return (
		<form onSubmit={handleSubmit} noValidate className="grid gap-4">
			<DialogHeader>
				<DialogTitle>Reservá tu clase</DialogTitle>
				<DialogDescription>
					Revisá los datos y contale a {teacher.name} qué querés trabajar.
				</DialogDescription>
			</DialogHeader>

			<dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 rounded-lg bg-muted/60 px-4 py-3">
				<dt className="text-muted-foreground">Docente</dt>
				<dd className="font-medium">{teacher.name}</dd>
				<dt className="text-muted-foreground">Día</dt>
				<dd className="font-medium first-letter:uppercase">
					{formatDayLong(slot.startsAt)}
				</dd>
				<dt className="text-muted-foreground">Hora</dt>
				<dd className="font-medium">
					{formatTime(slot.startsAt)}{" "}
					<span className="font-normal text-muted-foreground">
						(hora de Argentina)
					</span>
				</dd>
				<dt className="text-muted-foreground">Duración</dt>
				<dd className="font-medium">{slot.durationMin} minutos</dd>
			</dl>

			<div className="grid gap-2">
				<Label htmlFor={`${ids}-topic`}>
					¿Qué querés trabajar en la clase?
				</Label>
				<Textarea
					id={`${ids}-topic`}
					value={topic}
					onChange={(event) => setTopic(event.target.value)}
					placeholder="Por ejemplo: quiero armar un buscador con RAG sobre los PDFs de mi equipo."
					required
					minLength={TOPIC_MIN_LENGTH}
					maxLength={TOPIC_MAX_LENGTH}
					rows={4}
					disabled={busy}
					aria-invalid={topicError ? true : undefined}
					aria-describedby={`${ids}-hint`}
				/>
				<div
					id={`${ids}-hint`}
					className="flex justify-between gap-4 text-xs text-muted-foreground"
				>
					<span className="text-destructive" aria-live="polite">
						{topicError}
					</span>
					<span className="shrink-0 tabular-nums">
						{topic.length}/{TOPIC_MAX_LENGTH}
					</span>
				</div>
			</div>

			{slotGone ? (
				<Alert variant="destructive">
					<AlertCircleIcon aria-hidden />
					<AlertTitle>Este horario ya no está disponible</AlertTitle>
					<AlertDescription>
						Alguien lo reservó recién. Cerrá este diálogo y elegí otro horario.
					</AlertDescription>
				</Alert>
			) : (
				create.error && (
					<Alert variant="destructive">
						<AlertCircleIcon aria-hidden />
						<AlertTitle>No pudimos confirmar la reserva</AlertTitle>
						<AlertDescription>{errorMessage(create.error)}</AlertDescription>
					</Alert>
				)
			)}

			<DialogFooter>
				<DialogClose asChild>
					<Button type="button" variant="outline" disabled={busy}>
						Volver
					</Button>
				</DialogClose>
				<Button type="submit" disabled={busy || slotGone}>
					{busy && (
						<LoaderCircleIcon
							data-icon="inline-start"
							className="animate-spin"
							aria-hidden
						/>
					)}
					{busy ? "Reservando…" : "Confirmar reserva"}
				</Button>
			</DialogFooter>
		</form>
	);
}
