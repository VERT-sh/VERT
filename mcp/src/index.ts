#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import path from "node:path";

import {
	validateInputPath,
	validateOutputPath,
	validateFormat,
	validateAudioBitrate,
	validateSampleRate,
} from "./security.js";
import {
	buildFormatAllowlist,
	getConverter,
	getFormatInfo,
	listFormats,
	checkAvailability,
} from "./converters/registry.js";

// Build format allowlist once at startup
const FORMAT_ALLOWLIST = buildFormatAllowlist();

const server = new McpServer({
	name: "vert",
	version: "0.1.0",
});

// ── convert_file ──────────────────────────────────────────────────────────

server.tool(
	"convert_file",
	"Convert a file between formats. Supports 140+ image formats (via ImageMagick WASM), 28+ audio formats (via system ffmpeg), and 11 document formats (via system pandoc). Video input is supported for audio extraction (e.g., MP4 to MP3).",
	{
		input_path: z.string().describe("Absolute path to the input file"),
		output_format: z.string().describe("Target format extension (e.g. \"webp\", \"mp3\", \"docx\")"),
		output_path: z.string().optional().describe("Output file path. Defaults to input directory with new extension"),
		quality: z.number().min(1).max(100).optional().describe("Compression quality for lossy image formats (1-100)"),
		keep_metadata: z.boolean().optional().describe("Preserve file metadata. Defaults to true"),
		audio_bitrate: z.string().optional().describe("Audio bitrate (e.g. \"128k\", \"320k\")"),
		sample_rate: z.number().optional().describe("Audio sample rate in Hz (e.g. 44100, 48000)"),
	},
	async (params) => {
		try {
			// Validate input path
			const resolvedInput = await validateInputPath(params.input_path);

			// Validate output format
			const outputFormat = validateFormat(params.output_format, FORMAT_ALLOWLIST);

			// Validate input format
			const inputExt = path.extname(resolvedInput).slice(1).toLowerCase();
			if (!inputExt) {
				return {
					content: [{ type: "text", text: "Input file has no extension. Cannot determine format." }],
					isError: true,
				};
			}
			// Input format validation: check it's a known format (but don't block unsupported WASM
			// formats for input — they may be handled by ffmpeg/pandoc)
			if (!FORMAT_ALLOWLIST.has(inputExt)) {
				return {
					content: [{ type: "text", text: `Unknown input format: ${inputExt}` }],
					isError: true,
				};
			}

			// Determine output path
			let outputPath: string;
			if (params.output_path) {
				outputPath = params.output_path;
			} else {
				const dir = path.dirname(resolvedInput);
				const base = path.basename(resolvedInput, path.extname(resolvedInput));
				outputPath = path.join(dir, `${base}.${outputFormat}`);
			}

			// Validate output path
			const resolvedOutput = await validateOutputPath(outputPath, resolvedInput);

			// Validate optional params
			if (params.audio_bitrate !== undefined) {
				validateAudioBitrate(params.audio_bitrate);
			}
			if (params.sample_rate !== undefined) {
				validateSampleRate(params.sample_rate);
			}

			// Find a converter
			const converter = getConverter(inputExt, outputFormat);
			if (!converter) {
				return {
					content: [{ type: "text", text: `No converter available for ${inputExt} → ${outputFormat}` }],
					isError: true,
				};
			}

			// Check if the converter is available on this system
			const available = await converter.isAvailable();
			if (!available) {
				return {
					content: [{
						type: "text",
						text: `Converter "${converter.name}" is not available on this system. ${converter.name === "ffmpeg" ? "Install ffmpeg to convert audio files." : converter.name === "pandoc" ? "Install pandoc to convert documents." : ""}`,
					}],
					isError: true,
				};
			}

			// Run conversion
			const result = await converter.convert({
				inputPath: resolvedInput,
				outputPath: resolvedOutput,
				outputFormat,
				quality: params.quality,
				keepMetadata: params.keep_metadata,
				audioBitrate: params.audio_bitrate,
				sampleRate: params.sample_rate,
			});

			return {
				content: [{
					type: "text",
					text: JSON.stringify({
						output_path: result.outputPath,
						format: result.format,
						size_bytes: result.sizeBytes,
					}, null, 2),
				}],
			};
		} catch (err) {
			return {
				content: [{ type: "text", text: `Conversion failed: ${(err as Error).message}` }],
				isError: true,
			};
		}
	},
);

// ── list_formats ──────────────────────────────────────────────────────────

server.tool(
	"list_formats",
	"List supported file formats, optionally filtered by category. Returns format name, supported directions, category, and MIME type.",
	{
		category: z.enum(["image", "audio", "doc"]).optional().describe(
			"Filter by category: \"image\", \"audio\", or \"doc\""
		),
	},
	async (params) => {
		try {
			const formats = listFormats(params.category);
			const availability = await checkAvailability();

			return {
				content: [{
					type: "text",
					text: JSON.stringify({
						converters: availability,
						formats,
						total: formats.length,
					}, null, 2),
				}],
			};
		} catch (err) {
			return {
				content: [{ type: "text", text: `Failed to list formats: ${(err as Error).message}` }],
				isError: true,
			};
		}
	},
);

// ── get_format_info ───────────────────────────────────────────────────────

server.tool(
	"get_format_info",
	"Get detailed information about a specific file format, including supported conversion directions, category, MIME type, and which converter handles it.",
	{
		format: z.string().describe("File extension without dot (e.g. \"png\", \"mp3\", \"docx\")"),
	},
	async (params) => {
		try {
			const normalized = params.format.startsWith(".")
				? params.format.slice(1).toLowerCase()
				: params.format.toLowerCase();

			const info = getFormatInfo(normalized);
			if (!info) {
				return {
					content: [{ type: "text", text: `Unknown format: ${normalized}` }],
					isError: true,
				};
			}

			return {
				content: [{
					type: "text",
					text: JSON.stringify(info, null, 2),
				}],
			};
		} catch (err) {
			return {
				content: [{ type: "text", text: `Failed to get format info: ${(err as Error).message}` }],
				isError: true,
			};
		}
	},
);

// ── Start server ──────────────────────────────────────────────────────────

async function main(): Promise<void> {
	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error("[vert-mcp] Server started on stdio");
}

main().catch((err) => {
	console.error("[vert-mcp] Fatal error:", err);
	process.exit(1);
});
