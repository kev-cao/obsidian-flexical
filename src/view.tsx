import { ItemView, WorkspaceLeaf } from "obsidian";
import { createRoot, Root } from "react-dom/client";
import Calendar from "./components/Calendar";
import { StrictMode } from "react";
import FlexiCal from "./main";
import { PluginContext } from "./providers/pluginContext";

export const FLEXI_CAL_VIEW_TYPE = "flexi-cal-view";

export class FlexiCalView extends ItemView {
	private plugin: FlexiCal;
	private root: Root | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: FlexiCal) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType() {
		return FLEXI_CAL_VIEW_TYPE;
	}

	getDisplayText() {
		return "Flexical";
	}

	getIcon() {
		return "calendar-days";
	}

	async onOpen() {
		this.render();
	}

	async onClose() {
		this.root?.unmount();
		this.root = null;
	}

	private render() {
		if (!this.root) {
			this.root = createRoot(this.contentEl);
		}
		this.root.render(
			<StrictMode>
				<PluginContext.Provider value={this.plugin}>
					<div className="flexi-cal-container">
						<Calendar />
					</div>
				</PluginContext.Provider>
			</StrictMode>
		);
	}
}
