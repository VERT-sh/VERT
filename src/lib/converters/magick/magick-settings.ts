export const formatsWithoutTransparency = new Set([
	"jpg",
	"jpeg",
	"jfif",
	"jpe",
	"pjpeg",
	"gif87",
	"cin",
	"fax",
	"fit",
	"fits",
	"fts",
	"g3",
	"g4",
	"hrz",
	"jps",
	"mono",
	"otb",
	"pcd",
	"pcds",
	"pgx",
	"rgf",
	"six",
	"sixel",
	"wbmp",
	"xbm",
]);

export const formatsWithoutMetadataRemoval = new Set([
	// Raw pixel/sample formats
	"a",
	"b",
	"bgr",
	"bgra",
	"bgro",
	"cmyk",
	"cmyka",
	"gray",
	"graya",
	"rgb",
	"rgba",
	"rgbo",
	"uyvy",
	"ycbcr",
	"ycbcra",
	"yuv",

	// Simple/raw image representations
	"farbfeld",
	"ff",
	"fl32",
	"mono",
	"otb",
	"pgx",
	"rgf",

	// Terminal / display representations
	"hrz",
	"six",
	"sixel",

	// Simple bitmap formats
	"ubrl",
	"ubrl6",
	"wbmp",
	"xbm",

	// Texture / lookup / raw data formats
	"dxt1",
	"dxt5",
	"map",
	"pal",
]);
