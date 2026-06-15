import { App, PluginSettingTab, Setting } from "obsidian";
import FlexiCal from "./main";
import { Calendar, CalendarI, genCalendarID } from "./lib/calendar";
import logger from "./lib/utils/logging";
import FilterModal from "./components/settings/FilterModal";

export interface FlexiCalSettings {
	calendars: Calendar[];
	debugMode: boolean;
}

// The shape of data in the local data.json.
export type RawFlexiCalSettings = Omit<Partial<FlexiCalSettings>, "calendars"> & {
	calendars?: CalendarI[];
};

export const DEFAULT_SETTINGS: FlexiCalSettings = {
	calendars: [],
	debugMode: false,
};

export class FlexiCalSettingsTab extends PluginSettingTab {
	private plugin: FlexiCal;

	constructor(app: App, plugin: FlexiCal) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		new Setting(containerEl)
			.setName("Calendars")
			.setDesc("Manage your calendars")
			.setHeading()
			.addExtraButton(
				(btn) =>
					btn.setIcon("plus")
						.setTooltip("Add calendar")
						.onClick(async () => {
							const newCalendar = new Calendar(
								genCalendarID(),
								`Calendar ${this.plugin.settings.calendars.length + 1}`,
								"#000000",
								"",
								"",
								undefined,
							);
							this.plugin.settings.calendars.push(newCalendar);
							await this.plugin.saveSettings();
							return this.display();
						}
				)
			);

		this.plugin.settings.calendars.forEach((calendar, index) => {
			const calContainer = containerEl.createDiv({ cls: "flexi-cal-calendar-setting-group" });
			const calHeading = new Setting(calContainer)
				.setName(calendar.getName())
				.setHeading()
				.addExtraButton(
					(btn) =>
						btn.setIcon("trash")
						.setTooltip("Delete calendar")
						.onClick(async () => {
							this.plugin.settings.calendars.splice(index, 1);
							await this.plugin.saveSettings();
							return this.display();
						})
				);
			new Setting(calContainer)
				.setName("Name")
				.addText(
					text => text.setValue(calendar.getName())
						.onChange((value) => {
							calendar.setName(value);
							calHeading.setName(value);
							this.plugin.settings.calendars[index] = calendar;
							return this.plugin.saveSettings();
						})
				);
			new Setting(calContainer)
				.setName("Color")
				.addColorPicker(
					color => color.setValue(calendar.getColor())
						.onChange((value) => {
							calendar.setColor(value);
							this.plugin.settings.calendars[index] = calendar;
							return this.plugin.saveSettings();
						})
				);
			new Setting(calContainer)
				.setName("Date field")
				.setDesc(
					"The field in the frontmatter that contains the date for a note."
				)
				.addText(
					text => text.setValue(calendar.getDateField())
						.onChange((value) => {
							calendar.setDateField(value);
							this.plugin.settings.calendars[index] = calendar;
							return this.plugin.saveSettings();
						})
						.setPlaceholder("Example: date")
				);
			new Setting(calContainer)
				.setName("Week field")
				.setDesc(
					"The field in the frontmatter that contains the week for a note. This is optional and only used if you want to display weekly notes. The format should be ISO week format, e.g. `2023-W33`."
				)
				.addText(
					text => text.setValue(calendar.getWeekField())
						.onChange((value) => {
							calendar.setWeekField(value);
							this.plugin.settings.calendars[index] = calendar;
							return this.plugin.saveSettings();
						})
						.setPlaceholder("Example: week")
				);
			new Setting(calContainer)
				.setName("Filter")
				.addButton(
					(btn) =>
						btn.setButtonText("Edit filter")
							.onClick(() =>
									new FilterModal(this.app)
										.setValue(calendar.getFilter())
										.onChange((filter) => {
											calendar.setFilter(filter);
											this.plugin.settings.calendars[index] = calendar;
											return this.plugin.saveSettings();
										})
										.open()
								)
				);
		});

		new Setting(containerEl)
			.setName("Advanced")
			.setHeading()

		new Setting(containerEl)
			.setName("Debug mode")
			.addToggle(
				(toggle) =>
					toggle.setValue(this.plugin.settings.debugMode)
						.onChange((value) => {
							this.plugin.settings.debugMode = value;
							logger.setDebug(value);
							return this.plugin.saveSettings();
						})
			);

	}
}
