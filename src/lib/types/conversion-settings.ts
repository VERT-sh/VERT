/* eslint-disable @typescript-eslint/no-explicit-any */
export type SettingType = "number" | "select" | "boolean" | "string" | "range";

export interface SettingDefinition {
	key: string;
	label: string;
	type: SettingType;
	disabled?: boolean;
	default?: any;
	placeholder?: any;
	min?: number;
	max?: number;
	step?: number;
	options?: Array<{ value: any; label: any; speedValue?: any }>; // for select/range types
	description?: string;
	hasCustomInput?: boolean; // for select types with a "custom" option
	customInputKey?: string; // key to use for custom input value in settings object
    forceFullWidth?: boolean; // force setting to take up full width (usually grid 2)
}

export interface ConversionSettings {
	[key: string]: any;
}
