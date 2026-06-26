import { Filter, genFilterID, isOperandFilter, isPropertyFilter, OperandFilter, PathFilter, PROPERTY_FILTER_OPERATORS, PropertyFilter } from "@/lib/filter";
import { ReactElement, useState } from "react";
import { FILTER_SELECT_OPTIONS, KIND_TO_SELECT_OPTION, PROPERTY_TYPE_OPTIONS, PROPERTY_TYPE_TO_INPUT_TYPE } from "./filterText";
import ObsidianIconButton from "../IconButton";

const MAX_NESTING_LEVEL = 4;

interface FilterEditorProps {
	level: number; // Used to limit nesting to MAX_NESTING_LEVEL (1-indexed)
	initialFilter?: Filter;
	disabled?: boolean;
	onChange?: (filter: Filter | undefined) => Promise<void>;
}

const defaultFilter = (): Filter => ({
	id: genFilterID(),
	kind: "and",
	filters: [],
});

export default function FilterEditor({
	level,
	initialFilter,
	disabled,
	onChange,
}: FilterEditorProps) {
	const [filter, _setFilter] = useState(initialFilter);
	const updateFilter = (next: Filter | undefined) => {
		_setFilter(next);
		void onChange?.(next);
	};
	if (!filter) {
		return (
			<button
				disabled={disabled}
				onClick={() => updateFilter(defaultFilter())}
			>
				Add Filter
			</button>
		);
	}

	const setFilterSelect = (value: keyof typeof FILTER_SELECT_OPTIONS) => {
		let defaultFilter: Filter;
		switch (value) {
			case "All of the following...":
				defaultFilter = {
					id: genFilterID(),
					kind: "and",
					filters: [],
				};
				break;
			case "Any of the following...":
				defaultFilter = {
					id: genFilterID(),
					kind: "or",
					filters: [],
				};
				break;
			case "None of the following...":
				defaultFilter = {
					id: genFilterID(),
					kind: "not",
					filters: [],
				};
				break;
			case "Frontmatter property...":
				defaultFilter = {
					id: genFilterID(),
					kind: "property-tag",
					key: "",
					operator: "contains",
					value: "",
				};
				break;
			case "File path...":
				defaultFilter = {
					id: genFilterID(),
					kind: "path",
					operator: "matches",
					glob: "",
				};
				break;
		}
		updateFilter(defaultFilter);
	};

	let filterFields: (() => ReactElement) | null = null;
	if (isOperandFilter(filter)) {
		filterFields = () => (<OperandFilterFields
								  filter={filter}
								  level={level}
								  disabled={disabled}
								  onChange={async (filter) => {
									updateFilter(filter);
								  }}
							  />);
	} else if (isPropertyFilter(filter)) {
		filterFields = () => (<PropertyFilterFields
									filter={filter}
									disabled={disabled}
									onChange={async (filter) => {
										updateFilter(filter);
									}}
						/>);
	} else {
		filterFields = () => (<PathFilterFields
									filter={filter}
									disabled={disabled}
									onChange={async (filter) => {
										updateFilter(filter);
								}}
							/>);
	}

	return (
		<div>
			<div className="flexi-cal-filter-kind-selector">
				<select
					defaultValue={KIND_TO_SELECT_OPTION[filter.kind]}
					className="flexi-cal-filter-kind-select"
					disabled={disabled}
					onChange={(e) => {
						const value = e.target.value as keyof typeof FILTER_SELECT_OPTIONS;
						setFilterSelect(value);
					}}
				>
					{
						Object.keys(FILTER_SELECT_OPTIONS).map((label) => (
							<option key={label} value={label}>
								{label}
							</option>
						))
					}
				</select>
				<ObsidianIconButton
					iconId="circle-minus"
					onClick={
						() => {
							updateFilter(undefined);
						}
					}
				/>
			</div>
			{filterFields?.()}
		</div>
	);
}

interface FilterFieldsProps<T extends Filter> {
	filter: T;
	level: number;
	disabled?: boolean;
	onChange?: (filter: Filter | undefined) => Promise<void>;
}


function OperandFilterFields({ filter, level, disabled, onChange }: FilterFieldsProps<OperandFilter>) {
	return (
		<div>
			{
				// We add the length check to avoid rendering the children
				// margins if there are no children.
				filter.filters?.length > 0 && (
					<div className="flexi-cal-filter-children">
						{
							filter.filters.map((subFilter, index) => (
								<div key={subFilter.id}>
									<FilterEditor
										level={level + 1}
										initialFilter={subFilter}
										disabled={disabled}
										onChange={
											async (updatedSubFilter) => {
												if (!updatedSubFilter) {
													await onChange?.({
														...filter,
														filters: filter.filters.filter((_, i) => i !== index),
													});
												} else {
													await onChange?.({
														...filter,
														filters: filter.filters.map((f, i) => i === index ? updatedSubFilter : f),
													});
												}
											}
										}
									/>
								</div>
							))
						}
					</div>
				)
			}
			{
				level < MAX_NESTING_LEVEL && (
					<button
						className={"clickable-icon"}
						disabled={disabled}
						onClick={() => void onChange?.({
							...filter,
							filters: [...filter.filters, defaultFilter()],
						})}
					>
						Add sub-filter
					</button>
				)
			}
		</div>
	);
}

function PropertyFilterFields<T extends PropertyFilter>({ filter, disabled, onChange }: Omit<FilterFieldsProps<T>, "level">) {
	return (
		<div className="flexi-cal-property-filter-fields">
			<select
				defaultValue={filter.kind}
				disabled={disabled}
				onChange={(e) => {
					const kind = e.target.value as T["kind"];
					const updatedFilter: PropertyFilter = {
						kind: kind,
						operator: PROPERTY_FILTER_OPERATORS[kind][0],
						key: "",
						value: "",
					} as PropertyFilter;
					void onChange?.(updatedFilter);
				}}
			>
				{
					Object.entries(PROPERTY_TYPE_OPTIONS).map(([value, label]) => (
						<option key={value} value={value}>
							{label}
						</option>
					))
				}
			</select>
			property
			<input
				type="text"
				placeholder="key"
				value={filter.key}
				disabled={disabled}
				onChange={(e) => {
					const updatedFilter = {
						...filter,
						key: e.target.value,
					};
					void onChange?.(updatedFilter);
				}}
			/>
			<select
				defaultValue={filter.operator}
				disabled={disabled}
				onChange={(e) => {
					const operator = e.target.value as T["operator"];
					const updatedFilter = {
						...filter,
						operator,
					};
					void onChange?.(updatedFilter);
				}}
			>
				{
					PROPERTY_FILTER_OPERATORS[filter.kind].map((operator) => (
						<option key={operator} value={operator}>
							{operator}
						</option>
					))
				}
			</select>
			{
				filter.kind !== "property-checkbox" ? (
					<input
					type={PROPERTY_TYPE_TO_INPUT_TYPE[filter.kind]}
					placeholder="value"
					value={filter.value}
					disabled={disabled}
					onChange={(e) => {
						let updatedFilter = {
							...filter,
							value: e.target.value as string | number,
						};
						if (PROPERTY_TYPE_TO_INPUT_TYPE[filter.kind] === "number") {
							const numVal = e.target.valueAsNumber;
							updatedFilter.value = isNaN(numVal) ? 0 : numVal;
						}
						void onChange?.(updatedFilter);
					}}
					/>
				) : null
			}
		</div>
	);
}

function PathFilterFields({ filter, disabled, onChange }: Omit<FilterFieldsProps<PathFilter>, "level">) {
	return (
		<div className="flexi-cal-path-filter-fields">
			Path matches
			<input
				type="text"
				placeholder="Glob pattern (e.g. folder/*.md)"
				value={filter.glob}
				disabled={disabled}
				onChange={(e) => {
					const updatedFilter: PathFilter = {
						...filter,
						operator: "matches",
						glob: e.target.value,
					};
					void onChange?.(updatedFilter);
				}}
			/>
		</div>
	);
}
