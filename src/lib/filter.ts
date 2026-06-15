import picomatch from "picomatch/posix";
import { nanoid } from "nanoid";
import { CachedMetadata, TFile } from "obsidian";

export interface FileEntry {
	file: TFile;
	cache: CachedMetadata;
}

export type Filter =
	| PathFilter
	| PropertyFilter
	| AndFilter
	| OrFilter
	| NotFilter;

export interface PathFilter {
	id: string;
	kind: "path";
	operator: "matches";
	glob: string;
}

export type OperandFilter = AndFilter | OrFilter | NotFilter;

export interface AndFilter {
	id: string;
	kind: "and";
	filters: Filter[];
}

export interface OrFilter {
	id: string;
	kind: "or";
	filters: Filter[];
}

export interface NotFilter {
	id: string;
	kind: "not";
	filters: Filter[];
}

export function isOperandFilter(f: Filter): f is OperandFilter {
	return f.kind === "and" || f.kind === "or" || f.kind === "not";
}

type PropertyKind =
	| "text"
	| "number"
	| "date"
	| "checkbox"
	| "list"
	| "tag";

export type PropertyFilterKind = `property-${PropertyKind}`;

export type PropertyFilter =
	| TextPropertyFilter
	| NumberPropertyFilter
	| DatePropertyFilter
	| CheckboxPropertyFilter
	| ListPropertyFilter
	| TagPropertyFilter;

interface PropertyFilterBase {
	id: string;
	kind: PropertyFilterKind;
	key: string;
}

export const PROPERTY_FILTER_OPERATORS = {
	"property-text": ["contains", "eq", "matchesRegex"],
	"property-number": ["eq", "gt", "lt", "geq", "leq"],
	"property-date": ["eq", "gt", "lt", "geq", "leq"],
	"property-checkbox": ["is", "isNot"],
	"property-list": ["contains", "containsRegex"],
	"property-tag": ["contains", "containsRegex"],
} as const satisfies Record<PropertyFilterKind, readonly string[]>;

export interface TextPropertyFilter extends PropertyFilterBase {
	kind: "property-text";
	operator: typeof PROPERTY_FILTER_OPERATORS["property-text"][number];
	value: string;
}

export interface NumberPropertyFilter extends PropertyFilterBase {
	kind: "property-number";
	operator: typeof PROPERTY_FILTER_OPERATORS["property-number"][number];
	value: number;
}

export interface DatePropertyFilter extends PropertyFilterBase {
	kind: "property-date";
	operator: typeof PROPERTY_FILTER_OPERATORS["property-date"][number];
	value: string;
}

export interface CheckboxPropertyFilter extends PropertyFilterBase {
	kind: "property-checkbox";
	operator: typeof PROPERTY_FILTER_OPERATORS["property-checkbox"][number];
	value: boolean;
}

export interface ListPropertyFilter extends PropertyFilterBase {
	kind: "property-list";
	operator: typeof PROPERTY_FILTER_OPERATORS["property-list"][number];
	value: string;
}

export interface TagPropertyFilter extends PropertyFilterBase {
	kind: "property-tag";
	operator: typeof PROPERTY_FILTER_OPERATORS["property-tag"][number];
	value: string;
}

export function isPropertyFilter(f: Filter): f is PropertyFilter {
	return f.kind.startsWith("property-");
}

export function fileMatchesFilter(fileEntry: FileEntry, filter: Filter): boolean {
	switch (filter.kind) {
		case "and":
			return filter.filters.every((child) => fileMatchesFilter(fileEntry, child));
		case "or":
			return filter.filters.some((child) => fileMatchesFilter(fileEntry, child));
		case "not":
			return filter.filters.every((child) => !fileMatchesFilter(fileEntry, child));
		case "path":
			if (filter.glob === "") {
				return true;
			}
			return picomatch(filter.glob)(fileEntry.file.path);
		default:
			return fileMatchesPropertyFilter(fileEntry, filter);
	}
}

export function genFilterID(): string {
	return nanoid(5);
}

function fileMatchesPropertyFilter(fileEntry: FileEntry, filter: PropertyFilter): boolean {
	const { cache } = fileEntry;
	if (!cache.frontmatter) {
		return false;
	}
	switch (filter.kind) {
		case "property-text":
			return textPropertyPredicate(
				cache.frontmatter[filter.key],
				filter.value,
				filter.operator,
			);
		case "property-number":
			return numberPropertyPredicate(
				cache.frontmatter[filter.key],
				filter.value,
				filter.operator,
			);
		case "property-date":
			return datePropertyPredicate(
				cache.frontmatter[filter.key],
				filter.value,
				filter.operator,
			);
		case "property-checkbox":
			return checkboxPropertyPredicate(
				cache.frontmatter[filter.key],
				filter.value,
				filter.operator,
			);
		case "property-list":
		case "property-tag":
			return listPropertyPredicate(
				cache.frontmatter[filter.key],
				filter.value,
				filter.operator,
			);
	}
}

function textPropertyPredicate(
	lhs: unknown, rhs: string, operator: TextPropertyFilter["operator"],
): boolean {
	if (typeof lhs !== "string") {
		return false;
	}
	switch (operator) {
		case "contains":
			return lhs.includes(rhs);
		case "eq":
			return lhs === rhs;
		case "matchesRegex":
			return new RegExp(rhs).test(lhs);
	}
}

function numberPropertyPredicate(
	lhs: unknown, rhs: number, operator: NumberPropertyFilter["operator"],
): boolean {
	if (typeof lhs !== "number") {
		return false;
	}
	switch (operator) {
		case "eq":
			return lhs === rhs;
		case "gt":
			return lhs > rhs;
		case "lt":
			return lhs < rhs;
		case "geq":
			return lhs >= rhs;
		case "leq":
			return lhs <= rhs;
	}
}

function datePropertyPredicate(
	lhs: unknown, rhs: string, operator: DatePropertyFilter["operator"],
): boolean {
	if (typeof lhs !== "string") {
		return false;
	}
	const lhsDate = new Date(lhs);
	const rhsDate = new Date(rhs);
	switch (operator) {
		case "eq":
			return lhsDate.getTime() === rhsDate.getTime();
		case "gt":
			return lhsDate.getTime() > rhsDate.getTime();
		case "lt":
			return lhsDate.getTime() < rhsDate.getTime();
		case "geq":
			return lhsDate.getTime() >= rhsDate.getTime();
		case "leq":
			return lhsDate.getTime() <= rhsDate.getTime();
	}
}

function checkboxPropertyPredicate(
	lhs: unknown, rhs: boolean, operator: CheckboxPropertyFilter["operator"],
): boolean {
	if (typeof lhs !== "boolean") {
		return false;
	}
	switch (operator) {
		case "is":
			return lhs === rhs;
		case "isNot":
			return lhs !== rhs;
	}
}

function listPropertyPredicate(
	lhs: unknown, rhs: string, operator: ListPropertyFilter["operator"],
): boolean {
	if (!Array.isArray(lhs)) {
		return false;
	}
	if (!lhs.every((item) => typeof item === "string")) {
		return false;
	}
	switch (operator) {
		case "contains":
			return lhs.includes(rhs);
		case "containsRegex": {
			const regex = new RegExp(rhs);
			return lhs.some((item) => regex.test(item));
		}
	}
}

