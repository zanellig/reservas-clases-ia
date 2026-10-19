import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import { ChevronLeftIcon } from "lucide-react";
import { useState } from "react";
import { BookingDialog } from "~/components/booking-dialog";
import { TeacherAvatar } from "~/components/teacher-avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
	formatDayLong,
	formatTime,
	groupByDay,
	TIME_ZONE_NOTE,
} from "~/lib/format";
import { api } from "../../convex/_generated/api";

const teacherQuery = (slug: string) =>
	convexQuery(api.teachers.getBySlug, { slug });

export const Route = createFileRoute("/profesores/$slug")({
	loader: async ({ context, params }) => {
		const data = await context.queryClient.query({
			...teacherQuery(params.slug),
			staleTime: "static",
		});
		if (!data) throw notFound();
		return { name: data.teacher.name };
	},
	head: ({ loaderData }) => ({
		meta: [{ title: loaderData ? `${loaderData.name} · Aula IA` : "Aula IA" }],
	}),
	notFoundComponent: TeacherNotFound,
	component: TeacherPage,
});

type Slot = NonNullable<
	FunctionReturnType<typeof api.teachers.getBySlug>
>["slots"][number];

function TeacherPage() {
	const { slug } = Route.useParams();
	const { data } = useSuspenseQuery(teacherQuery(slug));
	const [selected, setSelected] = useState<Slot | null>(null);
	const [dialogOpen, setDialogOpen] = useState(false);

	// The query is live, so the teacher could disappear after the loader ran.
	if (!data) return <TeacherNotFound />;
	const { teacher, slots } = data;

	// Read availability from live data so the dialog reacts if someone else books it.
	const selectedAvailable =
		selected !== null &&
		slots.some((slot) => slot._id === selected._id && slot.available);

	return (
		<div>
			<Button asChild variant="ghost" size="sm" className="-ml-2.5">
				<Link to="/">
					<ChevronLeftIcon data-icon="inline-start" aria-hidden />
					Todos los profesores
				</Link>
			</Button>

			<div className="mt-6 grid gap-10 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-14">
				<section
					aria-labelledby="perfil"
					className="md:sticky md:top-8 md:self-start"
				>
					<TeacherAvatar
						name={teacher.name}
						photoUrl={teacher.photoUrl}
						className="size-24"
					/>
					<h1
						id="perfil"
						className="mt-5 text-2xl font-semibold tracking-tight sm:text-3xl"
					>
						{teacher.name}
					</h1>
					<p className="mt-1 text-muted-foreground">{teacher.headline}</p>
					<ul
						className="mt-4 flex flex-wrap gap-1.5"
						aria-label="Especialidades"
					>
						{teacher.specialties.map((specialty) => (
							<li key={specialty}>
								<Badge variant="outline">{specialty}</Badge>
							</li>
						))}
					</ul>
					<p className="mt-6 max-w-prose leading-relaxed text-pretty">
						{teacher.bio}
					</p>
				</section>

				<section aria-labelledby="horarios">
					<h2 id="horarios" className="text-lg font-semibold">
						Elegí un horario
					</h2>
					<p className="mt-1 text-sm text-muted-foreground">
						{TIME_ZONE_NOTE}. Cada clase dura 60 minutos.
					</p>

					{slots.length === 0 ? (
						<p className="mt-6 rounded-xl border border-dashed px-6 py-10 text-center text-muted-foreground">
							{teacher.name} no tiene horarios disponibles por ahora. Probá con
							otro profesor o volvé más tarde.
						</p>
					) : (
						<ol className="mt-6 divide-y rounded-xl border">
							{groupByDay(slots).map((daySlots) => (
								<li
									key={daySlots[0]._id}
									className="grid gap-3 p-4 sm:grid-cols-[11rem_1fr] sm:gap-4"
								>
									<h3 className="text-sm font-medium first-letter:uppercase sm:pt-2.5">
										{formatDayLong(daySlots[0].startsAt)}
									</h3>
									<ul className="flex flex-wrap gap-2">
										{daySlots.map((slot) => (
											<li key={slot._id}>
												<SlotButton
													slot={slot}
													onSelect={() => {
														setSelected(slot);
														setDialogOpen(true);
													}}
												/>
											</li>
										))}
									</ul>
								</li>
							))}
						</ol>
					)}
				</section>
			</div>

			{selected && (
				<BookingDialog
					key={selected._id}
					open={dialogOpen}
					onOpenChange={setDialogOpen}
					teacher={teacher}
					slot={selected}
					available={selectedAvailable}
				/>
			)}
		</div>
	);
}

function SlotButton({ slot, onSelect }: { slot: Slot; onSelect: () => void }) {
	const time = formatTime(slot.startsAt);
	if (!slot.available) {
		return (
			<Button
				variant="outline"
				disabled
				className="h-auto gap-1.5 px-3 py-2.5"
				aria-label={`${time}, reservado`}
			>
				<span className="tabular-nums line-through">{time}</span>
				<span className="text-xs font-normal">Reservado</span>
			</Button>
		);
	}
	return (
		<Button
			variant="outline"
			className="h-auto min-w-18 px-3 py-2.5 tabular-nums hover:border-foreground/40"
			aria-label={`Reservar ${formatDayLong(slot.startsAt)} a las ${time}`}
			aria-haspopup="dialog"
			onClick={onSelect}
		>
			{time}
		</Button>
	);
}

function TeacherNotFound() {
	return (
		<div className="mx-auto max-w-md py-8 text-center">
			<h1 className="text-xl font-semibold tracking-tight">
				No encontramos a este profesor
			</h1>
			<p className="mt-2 text-muted-foreground">
				Puede que el enlace esté mal escrito o que el perfil ya no exista.
			</p>
			<Button asChild className="mt-6">
				<Link to="/">Ver todos los profesores</Link>
			</Button>
		</div>
	);
}
