import {
	Events,
	EventRef,
	Plugin,
	WorkspaceLeaf,
	TAbstractFile,
    App,
} from "obsidian";
import {
	DEFAULT_SETTINGS,
	FlexiCalSettings,
	FlexiCalSettingsTab,
	RawFlexiCalSettings,
} from "./settings";
import { FLEXI_CAL_VIEW_TYPE, FlexiCalView } from "./view";
import logger from "./lib/utils/logging";
import { Calendar } from "./lib/calendar";

export default class FlexiCal extends Plugin {
	settings!: FlexiCalSettings;
	eventBus!: FlexiCalEventBus;

	async onload() {
		await this.loadSettings();
		this.eventBus = new FlexiCalEventBus(this.app);
		logger.setDebug(this.settings.debugMode);

		this.registerView(
			FLEXI_CAL_VIEW_TYPE,
			(leaf) => new FlexiCalView(leaf, this)
		);

		this.addRibbonIcon("calendar-days", "Show calendar", (_: MouseEvent) => {
			void this.activateView();
		});

		this.addCommand({
			id: "open-calendar",
			name: "Open calendar",
			callback: () => {
				void this.activateView();
			},
		});

		this.addSettingTab(new FlexiCalSettingsTab(this.app, this));
	}

	onunload() {}

	async activateView() {
		const { workspace } = this.app;
		let leaf: WorkspaceLeaf | undefined | null = null;
		const leaves = workspace.getLeavesOfType(FLEXI_CAL_VIEW_TYPE);

		if (leaves.length > 0) {
			// A leaf with our view already exists, use that.
			leaf = leaves[0];
		} else {
			// View could not be found in the workspace, create a leaf in the
			// right sidebar for it.
			leaf = workspace.getRightLeaf(false);
			await leaf?.setViewState({
				type: FLEXI_CAL_VIEW_TYPE,
				active: true,
			});
		}

		if (leaf) {
			// Reveal the leaf in case it is in a collapsed sidebar.
			return workspace.revealLeaf(leaf);
		}
	}

	async loadSettings() {
		const rawData = await this.loadData() as RawFlexiCalSettings;
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			rawData,
		);
		this.settings.calendars = (rawData?.calendars ?? []).map(cal => (
			Calendar.fromJSON(cal)
		));
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.eventBus.trigger(SETTINGS_UPDATED_EVENT, this.settings);
	}
}

export const SETTINGS_UPDATED_EVENT = "settings-updated";
export const FILE_CREATED_EVENT = "file-created";
export const FILE_DELETED_EVENT = "file-deleted";
export const FILE_MODIFIED_EVENT = "file-modified";

interface FlexiCalEventMap {
	[SETTINGS_UPDATED_EVENT]: FlexiCalSettings;
	[FILE_CREATED_EVENT]: TAbstractFile;
	[FILE_DELETED_EVENT]: TAbstractFile;
	[FILE_MODIFIED_EVENT]: TAbstractFile;
}

export class FlexiCalEventBus extends Events {
	constructor(app: App) {
		super();
		app.vault.on("create", (file) => {
			this.trigger(FILE_CREATED_EVENT, file);
		});
		app.vault.on("delete", (file) => {
			this.trigger(FILE_DELETED_EVENT, file);
		});
		app.metadataCache.on("changed", (file) => {
			this.trigger(FILE_MODIFIED_EVENT, file);
		});
	}

	trigger<K extends keyof FlexiCalEventMap>(eventName: K, data: FlexiCalEventMap[K]): void {
		super.trigger(eventName, data);
	}

	on<K extends keyof FlexiCalEventMap>(
		eventName: K,
		callback: (data: FlexiCalEventMap[K]) => void,
	): EventRef {
		return super.on(eventName, (...data: unknown[]) => {
			callback(data[0] as FlexiCalEventMap[K]);
		});
	}
}
