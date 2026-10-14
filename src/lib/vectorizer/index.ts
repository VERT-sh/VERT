import type { Config, OptimizeOptions } from "@neplex/vectorizer";

export enum ColorMode {
	// Trace the image using colour clusters
	Color = 0,
	// Trace the image as a black and white image
	Binary = 1,
}
export enum Hierarchical {
	// Render traced layers stacked on top of each other
	Stacked = 0,
	// Render traced layers as cutouts
	Cutout = 1,
}
export enum PathSimplifyMode {
	// Do not simplify paths
	None = 0,
	// Simplify paths into polygons
	Polygon = 1,
	// Fit paths as splines
	Spline = 2,
}

export interface VectorizerModule {
	vectorizeSync(source: Uint8Array, config?: Config): string;
	optimizeSync(input: string, options?: OptimizeOptions): string;
}

export const DETAIL_LEVELS = ["bw", "poster", "photo"] as const;
export type DetailLevel = (typeof DETAIL_LEVELS)[number];

// "stolen" from https://github.com/twlite/vectorizer-playground/blob/main/src/lib/vectorizer-config.ts
const DEFAULT_CONFIG = {
	filterSpeckle: 4,
	spliceThreshold: 45,
	cornerThreshold: 60,
	lengthThreshold: 5,
	maxIterations: 2,
	pathPrecision: 5,
	unusedColorIterations: 24,
	keyingThreshold: 0.2,
	smallCircle: 2,
	layerDifference: 5,
} satisfies Partial<Config>;

export function buildConfig(detail: DetailLevel): Config {
	switch (detail) {
		case "bw":
			return {
				...DEFAULT_CONFIG,
				colorMode: ColorMode.Binary,
				hierarchical: Hierarchical.Stacked,
				mode: PathSimplifyMode.Spline,
				colorPrecision: 6,
			};
		case "photo":
			return {
				...DEFAULT_CONFIG,
				colorMode: ColorMode.Color,
				hierarchical: Hierarchical.Cutout,
				mode: PathSimplifyMode.Spline,
				colorPrecision: 8,
			};
		case "poster":
		default:
			return {
				...DEFAULT_CONFIG,
				colorMode: ColorMode.Color,
				hierarchical: Hierarchical.Stacked,
				mode: PathSimplifyMode.Polygon,
				colorPrecision: 8,
			};
	}
}

let modulePromise: Promise<VectorizerModule> | null = null;

export function loadVectorizer(): Promise<VectorizerModule> {
	return (modulePromise ??= import("@neplex/vectorizer").then(
		(mod) => mod as unknown as VectorizerModule,
	));
}
