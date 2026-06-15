import { App, FuzzySuggestModal, TFile } from "obsidian";

export class FilePickerModal extends FuzzySuggestModal<TFile> {
	private files: TFile[];

	constructor(app: App, placeholder: string, files: TFile[]) {
		super(app);
		this.files = files;
		this.setPlaceholder(placeholder);
	}

	getItems(): TFile[] {
		return this.files;
	}

	getItemText(item: TFile): string {
		return item.path;
	}

	onChooseItem(item: TFile, _: MouseEvent | KeyboardEvent) {
		void this.app.workspace.getLeaf().openFile(item);
	}
}
