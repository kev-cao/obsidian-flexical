import { useCallback, useEffect, useRef, useState } from "react";
import { setIcon, TAbstractFile } from "obsidian";
import { Calendar as VanillaCalendar } from "vanilla-calendar-pro";
import { getDateString } from "vanilla-calendar-pro/utils";
import { CalendarFileMatch, CalendarID, collectMatches, DateRange, toDateKey } from "@/lib/calendar";
import { FilePickerModal } from "./FilePickerModal";
import { usePlugin } from "@/providers/pluginContext";
import logger from "@/lib/utils/logging";
import {
	FILE_CREATED_EVENT,
	FILE_DELETED_EVENT,
	FILE_MODIFIED_EVENT,
	SETTINGS_UPDATED_EVENT,
} from "@/main";
import { FlexiCalSettings } from "@/settings";

const MAX_DOTS_PER_DAY = 6;

export default function FlexiCalendar() {
	const ref = useRef(null);
	const plugin = usePlugin();
	const [vanillaCalendar, setVanillaCalendar] = useState<VanillaCalendar | null>(null);
	const [period, setPeriod] = useState<DateRange | null>(null);
	const [settings, setSettings] = useState<FlexiCalSettings | undefined>(
		plugin?.settings ? { ...plugin.settings } : undefined
	);
	const oldSettings = useRef(settings);
	// Maps a YYYY-MM-DD day to the colors of every calendar with a match on it.
	// A ref (not state) so onCreateDateEls always reads current data without
	// needing to be re-registered on the vanilla calendar.
	const matchesByDate = useRef(new Map<string, CalendarFileMatch[]>());

	const refreshMatches = useCallback(() => {
		if (!period || !vanillaCalendar || !plugin || !settings) return;
		const dateToMatches = new Map<string, CalendarFileMatch[]>();
		for (const match of collectMatches(settings.calendars, plugin.app, period)) {
			const key = toDateKey(match.date);
			const matches = dateToMatches.get(key) ?? [];
			matches.push(match);
			dateToMatches.set(key, matches);
		}
		matchesByDate.current = dateToMatches;
		// Preserve the navigated month/year and any selected date; update()
		// otherwise resets them to the initial construction options, which
		// snaps the display back on every arrow click.
		vanillaCalendar.update({ year: false, month: false, dates: false });
	}, [period, vanillaCalendar, settings, plugin]);

	useEffect(() => {
		if (!ref.current || !plugin?.app) return;
		const syncPeriod = (self: VanillaCalendar) => {
			setPeriod(getCalendarDateRange(self));
		};
		const today = getDateString(new Date());
		const cal = new VanillaCalendar(ref.current, {
			dateToday: today,
			onClickArrow: syncPeriod,
			onClickMonth: syncPeriod,
			onClickYear: syncPeriod,
			onCreateDateEls: (_, dateEl) => {
				if (dateEl.dataset.vcDateMonth !== "current") return;
				const matches = matchesByDate.current.get(dateEl.dataset.vcDate ?? "");
				if (!matches?.length) return;
				const btn = dateEl.querySelector<HTMLElement>("[data-vc-date-btn]");
				if (!btn) return;
				const row = btn.createDiv({ cls: "flexi-cal-dots" });
				const colors = roundRobinColors(matches);
				for (const { color, count } of colors) {
					for (let i = 0; i < count; i++) {
						row.createSpan({ cls: "flexi-cal-dot" }).style.backgroundColor = color;
					}
				}
			},
			onClickDate: (self) => {
				const selectedDate = new Date(self.context.selectedDates[0]!);
				if (isNaN(selectedDate.getTime())) return;
				const matches = matchesByDate.current.get(toDateKey(selectedDate)) ?? [];
				if (matches.length === 0) return;
				const files = matches.map((match) => match.file);
				if (files.length === 1) {
					void plugin.app.workspace.getLeaf().openFile(files[0]!);
				} else {
					new FilePickerModal(plugin.app, selectedDate.toDateString(), files).open();
				}
			},
			onUpdate: (self) => {
				setPeriod((currPeriod) => {
					const newPeriod = getCalendarDateRange(self);
					if (!currPeriod || !newPeriod.equals(currPeriod)) return newPeriod;
					return currPeriod;
				});
			},
		});
		configureCalendarLayout(cal);
		setVanillaCalendar(cal);
		cal.init();
		syncPeriod(cal);

		// Check if date has changed every hour.
		const todayInterval = window.setInterval(() => {
			const today = getDateString(new Date());
			cal.set({ dateToday: today }, {
				dates: true
			});
		}, 1000 * 60 * 60 /* every hour */);
		return () => {
			window.clearInterval(todayInterval);
		};
	}, [plugin?.app, ref]);

	// Set up listeners to refresh views when files are changed or when settings
	// are updated.
	useEffect(() => {
		if (!plugin || !period) return;
		const onFileChange = (file: TAbstractFile) => {
			logger.debug(`File changed (${file.path}); refreshing matches`);
			refreshMatches();
		};
		const refs = [
			plugin.eventBus.on(
				SETTINGS_UPDATED_EVENT,
				(settings) => setSettings({...settings}),
			),
			plugin.eventBus.on(FILE_CREATED_EVENT, onFileChange),
			plugin.eventBus.on(FILE_DELETED_EVENT, onFileChange),
			plugin.eventBus.on(FILE_MODIFIED_EVENT, onFileChange),
		];
		return () => refs.forEach((ref) => plugin.eventBus.offref(ref));
	}, [plugin, period, refreshMatches]);

	// Adds custom chevron icons to the prev/next buttons on the calendar.
	useEffect(() => {
		if (!vanillaCalendar) return;
		const root = vanillaCalendar.context.mainElement;
		const paint = () => {
			const prev = root.getElementsByClassName(vanillaCalendar.styles.arrowPrev);
			const next = root.getElementsByClassName(vanillaCalendar.styles.arrowNext);
			Array.from(prev).forEach((el) => {
				if (!el.querySelector("svg")) setIcon(el as HTMLElement, "chevron-left");
			});
			Array.from(next).forEach((el) => {
				if (!el.querySelector("svg")) setIcon(el as HTMLElement, "chevron-right");
			});
		};
		const obs = new MutationObserver(paint);
		obs.observe(root, { childList: true, subtree: true });
		paint();
		return () => {
			obs.disconnect();
		};
	}, [vanillaCalendar]);

	useEffect(() => {
		logger.debug("Settings changed");
		refreshMatches();
		oldSettings.current = settings ? { ...settings } : undefined;
	}, [oldSettings, settings])
	useEffect(() => {
		refreshMatches();
	}, [period]);

	return (
		<div ref={ref} />
	);
}

function configureCalendarLayout(calendar: VanillaCalendar) {
	calendar.layouts = {
		...calendar.layouts,
		default: getDefaultLayout(calendar),
		month: getMonthLayout(calendar),
		year: getYearLayout(calendar),
	};
}

function getDefaultLayout(calendar: VanillaCalendar): string {
	const cls = calendar.styles;
	const labels = calendar.labels;
	return `
	<div class="${cls.header}" data-vc="header" role="toolbar">
		<div class="vc-navigator" data-vc="navigator" aria-label="${labels.navigation}">
			<#ArrowPrev [month] />
			<div class="${cls.headerContent}" data-vc-navigator="content">
				<#Month />
				<#Year />
			</div>
			<#ArrowNext [month] />
		</div>
	</div>
	<div class="${cls.wrapper}" data-vc="wrapper">
		<#WeekNumbers />
		<div class="${cls.content}" data-vc="content">
			<#Week />
			<#Dates />
			<#DateRangeTooltip />
		</div>
	</div>
	`;
}

function getMonthLayout(calendar: VanillaCalendar): string {
	const cls = calendar.styles;
	const labels = calendar.labels;
	return `
	<div class="${cls.header}" data-vc="header" role="toolbar">
		<div class="vc-navigator" data-vc="navigator" aria-label="${labels.navigation}">
			<div class="${cls.headerContent}" data-vc-navigator="content">
			  <#Month />
			  <#Year />
			</div>
		</div>
	</div>
	<div class="${cls.wrapper}" data-vc="wrapper">
		<div class="${cls.content}" data-vc="content">
		  <#Months />
		</div>
	</div>
	`;
}

function getYearLayout(calendar: VanillaCalendar): string {
	const cls = calendar.styles;
	const labels = calendar.labels;
	return `
	<div class="${cls.header}" data-vc="header" role="toolbar">
		<div class="vc-navigator" data-vc="navigator" aria-label="${labels.navigation}">
			<#ArrowPrev [year] />
			<div class="${cls.headerContent}" data-vc-navigator="content">
				<#Month />
				<#Year />
			</div>
			<#ArrowNext [year] />
		</div>
	</div>
	<div class="${cls.wrapper}" data-vc="wrapper">
		<div class="${cls.content}" data-vc="content">
			<#Years />
		</div>
	</div>
	`;
}

// TODO: Until short month displays are easily configured, won't include
// this view switcher since it makes maintaining a consistent UI difficult.
/*
function getViewSwitcher(): string {
	return `
	<div class="vc-view-switcher" data-vc="view-switcher" role="group" aria-label="Calendar View Switcher">
		<input type="radio" name="vc-view" id="vc-monthly" data-vc-view-switcher="input"
			${this.settings.defaultView === "monthly" ? "checked" : ""}
		>
		<label for="vc-monthly" data-vc-view-switcher="label">Month</label>

		<input type="radio" name="vc-view" id="vc-weekly" data-vc-view-switcher="input"
			${this.settings.defaultView === "weekly" ? "checked" : ""}
		>
		<label for="vc-weekly" data-vc-view-switcher="label">Week</label>

		<div data-vc-view-switcher="slider"></div>
	</div>
	`
}
*/

// roundRobinColors takes in a list of matches for a given day and returns a list of colors
// and counts for how many dots of each color to display, up to the MAX_DOTS_PER_DAY limit. It
// distributes the colors in a round-robin way to ensure that if one calendar has many matches on
// a day and another has few, the colors from the smaller calendar still show up instead of being
// completely overshadowed by the larger calendar.
function roundRobinColors(matches: CalendarFileMatch[]): {color: string, count: number}[] {
	if (matches.length === 0) {
		return [];
	}
	const calendarToMatches: Record<CalendarID, CalendarFileMatch[]> = {};
	const calendarToColor: Record<CalendarID, string> = {};
	for (const match of matches) {
		const calendarId = match.calendar.getId();
		const matchesForCalendar = calendarToMatches[calendarId] ?? [];
		matchesForCalendar.push(match);
		calendarToMatches[calendarId] = matchesForCalendar;
		calendarToColor[calendarId] = match.calendar.getColor();
	}

	const calendarNumMatches = Object.entries(calendarToMatches)
									.sort((a, b) => a[0] > b[0] ? 1 : -1)
									.map(([id, matches]) => ({ id, count: matches.length }));
	let roundRobinIdx = 0;
	const colorCounts: {color: string, count: number}[] = calendarNumMatches.map(({ id }) => ({
		color: calendarToColor[id] ?? "#000000",
		count: 0,
	}));
	for (let i = 0; i < MAX_DOTS_PER_DAY; i++) {
		let count = calendarNumMatches[roundRobinIdx]!.count;
		const ogRoundRobinIdx = roundRobinIdx;
		while (count === 0) {
			roundRobinIdx = (roundRobinIdx + 1) % calendarNumMatches.length;
			if (roundRobinIdx === ogRoundRobinIdx) break;
			count = calendarNumMatches[roundRobinIdx]!.count;
		}
		if (count === 0) break;
		colorCounts[roundRobinIdx]!.count++;
		calendarNumMatches[roundRobinIdx]!.count--;
		roundRobinIdx = (roundRobinIdx + 1) % calendarNumMatches.length;
	}
	return colorCounts;
}

function getCalendarDateRange(calendar: VanillaCalendar): DateRange {
	return new DateRange(
		new Date(Date.UTC(calendar.context.selectedYear, calendar.context.selectedMonth, 1)),
		new Date(Date.UTC(calendar.context.selectedYear, calendar.context.selectedMonth + 1, 1)),
	);
}
