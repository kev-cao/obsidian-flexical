import { App, TFile } from "obsidian";
import { Filter, FileEntry, fileMatchesFilter } from "./filter";
import { nanoid } from "nanoid";
import logger from "./utils/logging";

export type CalendarID = string;

export interface CalendarI {
	id: CalendarID;
	name: string;
	color: string;
	dateField: string;
	weekField: string;
	filter?: Filter;
}

export class DateRange {
	public start: Date;
	public end: Date;

	constructor(start: Date, end: Date) {
		if (start > end) {
			throw new Error(
				`invalid DateRange: start date ${start.toISOString()} is after end date ${end.toISOString()}`,
			);
		}
		this.start = start;
		this.end = end;
	}

	equals(other: DateRange): boolean {
		return this.start.getTime() === other.start.getTime() &&
			this.end.getTime() === other.end.getTime();
	}
}

export interface CalendarFileMatch {
	calendar: Calendar;
	file: TFile;
	date: Date;
}

export class Calendar {
	constructor(
		private id: string,
		private name: string,
		private color: string,
		private dateField: string,
		private weekField: string,
		private filter?: Filter,
	) { }

	getId(): string {
		return this.id;
	}

	getName(): string {
		return this.name;
	}

	setName(name: string) {
		this.name = name;
	}

	getColor(): string {
		return this.color;
	}

	setColor(color: string) {
		this.color = color;
	}

	getDateField(): string {
		return this.dateField;
	}

	setDateField(dateField: string) {
		this.dateField = dateField;
	}

	getWeekField(): string {
		return this.weekField;
	}

	setWeekField(weekField: string) {
		this.weekField = weekField;
	}

	getFilter(): Filter | undefined {
		return this.filter;
	}

	setFilter(filter?: Filter) {
		this.filter = filter;
	}

	// matchFile returns a match if the given file falls within the range
	// (inclusive start, exclusive end) and satisfies this calendar's filter,
	// or null otherwise.
	matchFile(entry: FileEntry, range: DateRange): CalendarFileMatch | null {
		const { file, cache } = entry;
		if (!cache.frontmatter) {
			return null;
		}
		const dateValue: unknown = cache.frontmatter[this.dateField];
		const weekValue: unknown = cache.frontmatter[this.weekField];
		let date: Date | null = null;
		if (dateValue) {
			date = extractDateFromField(dateValue);
		} else if (weekValue) {
			date = extractWeekFromField(weekValue);
		}
		if (!date || date < range.start || date >= range.end) {
			return null;
		}
		if (this.filter && !fileMatchesFilter(entry, this.filter)) {
			return null;
		}
		return { calendar: this, file, date };
	}

	toJSON(): CalendarI {
		return {
			id: this.id,
			name: this.name,
			color: this.color,
			dateField: this.dateField,
			weekField: this.weekField,
			filter: this.filter,
		};
	}

	static fromJSON(data: CalendarI): Calendar {
		return new Calendar(
			data.id, data.name, data.color, data.dateField, data.weekField, data.filter,
		);
	}
}

// collectMatches scans every markdown file in the vault once and assigns each
// to the first calendar (in order) that matches it within the range, so a file
// belongs to at most one calendar. Earlier calendars take precedence.
export function collectMatches(
	calendars: Calendar[],
	app: App,
	range: DateRange,
): CalendarFileMatch[] {
	const matches: CalendarFileMatch[] = [];
	const files = app.vault.getMarkdownFiles();
	for (const file of files) {
		const cache = app.metadataCache.getFileCache(file);
		if (!cache) {
			logger.error(`No cache for file ${file.path}`);
			continue;
		}
		const entry: FileEntry = { file, cache };
		for (const calendar of calendars) {
			const match = calendar.matchFile(entry, range);
			if (match) {
				matches.push(match);
				break;
			}
		}
	}
	logger.debug(
		`collectMatches: ${matches.length}/${files.length} files matched across ` +
		`${calendars.length} calendars for ${range.start.toISOString()} – ${range.end.toISOString()}`,
	);
	return matches;
}

// toDateKey formats a Date as a YYYY-MM-DD string using UTC components, to
// match how extractDateFromField parses frontmatter dates and the local day
// strings vanilla-calendar-pro assigns to its cells.
export function toDateKey(date: Date): string {
	const year = date.getUTCFullYear();
	const month = String(date.getUTCMonth() + 1).padStart(2, "0");
	const day = String(date.getUTCDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function extractDateFromField(dateValue: unknown): Date | null {
	if (typeof dateValue !== "string") {
		logger.error("Date field value is not a string: ", dateValue);
		return null;
	}

	let normalizedDate = dateValue;
	if (normalizedDate.includes("T")) {
		// Only force UTC when the value has no timezone designator; appending
		// "Z" to a value that already carries one (e.g. "+02:00") is invalid.
		const hasZone = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(normalizedDate);
		normalizedDate = hasZone ? normalizedDate : `${normalizedDate}Z`;
	} else {
		normalizedDate = `${normalizedDate}T00:00:00Z`;
	}
	const date = new Date(normalizedDate);
	if (isNaN(date.getTime())) {
		logger.error(`Invalid date value: ${normalizedDate}`);
		return null;
	}
	return date;
}

function extractWeekFromField(weekValue: unknown): Date | null {
	if (typeof weekValue !== "string") {
		logger.error("Week field value is not a string: ", weekValue);
		return null;
	}

	const match = weekValue.match(/(\b\d{4})-W(\d{2})\b/);
	if (!match) {
		logger.error(`Invalid week format: ${weekValue}`);
		return null;
	}
	const year = parseInt(match[1]!, 10);
	const week = parseInt(match[2]!, 10);
	// Build in UTC so the result matches toDateKey/extractDateFromField, which
	// also operate in UTC. Using local time would shift the day by the offset.
	const jan4 = new Date(Date.UTC(year, 0, 4));
	// ISO weeks start on Monday (1). If jan4 is Sunday (0), treat it as 7.
	const dayOfWeek = jan4.getUTCDay() || 7;
	const mondayOfWeek1 = jan4.getUTCDate() - dayOfWeek + 1;
	const targetDate = new Date(Date.UTC(year, 0, mondayOfWeek1 + (week - 1) * 7));
	return targetDate;
}

export function genCalendarID(): CalendarID {
	return nanoid(5);
}
