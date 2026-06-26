import { Filter, PropertyFilter } from "@/lib/filter";

export const FILTER_SELECT_OPTIONS = {
	"All of the following...": ["and"],
	"Any of the following...": ["or"],
	"None of the following...": ["not"],
	"Frontmatter property...": [
		"property-text",
		"property-number",
		"property-date",
		"property-checkbox",
		"property-list",
		"property-tag"
	],
	"File path...": ["path"],
} as const satisfies Record<string, Filter["kind"][]>;

export const KIND_TO_SELECT_OPTION: Record<Filter["kind"], keyof typeof FILTER_SELECT_OPTIONS> =
	Object.entries(FILTER_SELECT_OPTIONS)
			.reduce((acc, [option, kinds]) => {
				kinds.forEach((kind) => {
					acc[kind] = option as keyof typeof FILTER_SELECT_OPTIONS;
				});
				return acc;
			}, {} as Record<Filter["kind"], keyof typeof FILTER_SELECT_OPTIONS>);

export const PROPERTY_TYPE_OPTIONS: Record<PropertyFilter["kind"], string> = {
	"property-text": "Text",
	"property-number": "Number",
	"property-date": "Date",
	"property-checkbox": "Checkbox",
	"property-list": "List",
	"property-tag": "Tag",
};

export const PROPERTY_TYPE_TO_INPUT_TYPE: Record<PropertyFilter["kind"], string> = {
	"property-text": "text",
	"property-number": "number",
	"property-date": "date",
	"property-list": "text",
	"property-tag": "text",
	"property-checkbox": "", // We don't display an input for checkbox types.
}
