/* eslint-disable @typescript-eslint/no-explicit-any */
export type SettingType = "number" | "select" | "boolean" | "string" | "range";

export interface SettingDefinition {
    key: string;
    label: string;
    type: SettingType;
    default?: any;
    placeholder?: any;
    min?: number;
    max?: number;
    step?: number;
    options?: Array<{ value: any; label: any }>; // for select types
    description?: string;
    hasCustomInput?: boolean; // for select types with a "custom" option
    customInputKey?: string; // key to use for custom input value in settings object
}

export interface ConversionSettings {
    [key: string]: any;
}