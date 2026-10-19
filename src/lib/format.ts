// Fixed zone + locale so SSR (UTC) and the browser render the same strings.
const TIME_ZONE = "America/Argentina/Buenos_Aires";
const LOCALE = "es-AR";

const dayLong = new Intl.DateTimeFormat(LOCALE, {
	timeZone: TIME_ZONE,
	weekday: "long",
	day: "numeric",
	month: "long",
});
const dayShort = new Intl.DateTimeFormat(LOCALE, {
	timeZone: TIME_ZONE,
	weekday: "short",
	day: "numeric",
	month: "short",
});
const time = new Intl.DateTimeFormat(LOCALE, {
	timeZone: TIME_ZONE,
	hour: "2-digit",
	minute: "2-digit",
	hourCycle: "h23",
});
// en-CA formats as YYYY-MM-DD, which sorts and compares as a string.
const dayKey = new Intl.DateTimeFormat("en-CA", {
	timeZone: TIME_ZONE,
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
});

/** "martes 20 de octubre" */
export const formatDayLong = (ms: number) =>
	dayLong.format(ms).replace(",", "");

/** "mar 20 oct" */
export const formatDayShort = (ms: number) =>
	dayShort.format(ms).replace(",", "");

/** "14:00" */
export const formatTime = (ms: number) => time.format(ms);

/** "2026-10-20", the calendar day in Argentina. */
export const formatDayKey = (ms: number) => dayKey.format(ms);

/** Groups items by Argentina calendar day, keeping input order. */
export function groupByDay<T extends { startsAt: number }>(items: Array<T>) {
	const groups = new Map<string, Array<T>>();
	for (const item of items) {
		const key = formatDayKey(item.startsAt);
		groups.set(key, [...(groups.get(key) ?? []), item]);
	}
	return [...groups.values()];
}

export const TIME_ZONE_NOTE = "Horarios en hora de Argentina";
