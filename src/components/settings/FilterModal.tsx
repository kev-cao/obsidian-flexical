import { App, Modal } from "obsidian";
import { createRoot, Root } from "react-dom/client";
import FilterEditor from "./FilterEditor";
import { Filter } from "@/lib/filter";

export default class FilterModal extends Modal {
	private reactRoot: Root | null = null;
	private filter?: Filter;
	private onChangeCb?: (filter: Filter | undefined) => Promise<void>;

	constructor(app: App) {
		super(app);
	}

	setValue(filter: Filter | undefined): this {
		this.filter = filter;
		this.render();
		return this;
	}

	onChange(callback: (filter: Filter | undefined) => Promise<void>): this {
		this.onChangeCb = (filter: Filter | undefined) => {
			this.filter = filter;
			return callback(filter);
		};
		this.render();
		return this;
	}

	onClose() {
		this.reactRoot?.unmount();
		this.reactRoot = null;
	}

	render() {
		if (!this.reactRoot) {
			this.reactRoot = createRoot(this.contentEl);
		}
		this.reactRoot.render(
			<>
				<h3>Configure filters</h3>
				<FilterEditor
					level={1}
					initialFilter={this.filter}
					onChange={this.onChangeCb}
				/>
			</>
		);
	}
}
