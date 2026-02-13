/* eslint-disable @typescript-eslint/no-explicit-any */
export type SettingType = "number" | "select" | "boolean" | "string" | "range";

export interface SettingDefinition {
    key: string;
    label: () => string;
    type: SettingType;
    default: any;
    min?: number;
    max?: number;
    step?: number;
    options?: Array<{ value: string; label: string }>; // for select types
    description?: string;
}

export interface ConversionSettings {
    [key: string]: any;
}