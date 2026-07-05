/**
 * ICNS (Apple Icon Image) file format encoder
 *
 * Creates .icns files from PNG images at various sizes.
 *
 * File structure:
 * - 8 byte header: 'icns' magic + 4 byte file length (big-endian)
 * - Icon elements: OSType (4 bytes) + length (4 bytes) + data
 *
 * References:
 * - https://en.wikipedia.org/wiki/Apple_Icon_Image_format
 * - https://github.com/fiahfy/icns
 */

/**
 * Icon type definitions for ICNS format
 * Maps pixel dimensions to OSType codes
 *
 * Only modern PNG-based types (OS X 10.5+) are included.
 * Legacy types (is32, il32, ih32, etc.) require raw RGB + mask encoding
 * and are not supported by this encoder.
 */
export const ICNS_TYPES = {
	// Modern PNG-based formats (OS X 10.5+)
	'ic07': { size: 128, scale: 1, format: 'png' },   // 128x128
	'ic08': { size: 256, scale: 1, format: 'png' },   // 256x256
	'ic09': { size: 512, scale: 1, format: 'png' },   // 512x512
	'ic10': { size: 1024, scale: 2, format: 'png' },  // 1024x1024 (512x512@2x retina)
	'ic11': { size: 32, scale: 2, format: 'png' },    // 32x32 (16x16@2x retina)
	'ic12': { size: 64, scale: 2, format: 'png' },    // 64x64 (32x32@2x retina)
	'ic13': { size: 256, scale: 2, format: 'png' },   // 256x256 (128x128@2x retina)
	'ic14': { size: 512, scale: 2, format: 'png' },   // 512x512 (256x256@2x retina)
} as const;

export type IconType = keyof typeof ICNS_TYPES;

export interface IconEntry {
	type: IconType;
	data: Uint8Array;
}

/**
 * Encodes icon entries into a complete ICNS file
 */
export function encodeIcns(entries: IconEntry[]): Uint8Array {
	if (entries.length === 0) {
		throw new Error('At least one icon entry is required');
	}

	// Calculate total file size
	let totalSize = 8; // Header size
	for (const entry of entries) {
		totalSize += 8 + entry.data.length; // type (4) + length (4) + data
	}

	// Create output buffer
	const buffer = new ArrayBuffer(totalSize);
	const view = new DataView(buffer);
	const uint8 = new Uint8Array(buffer);

	let offset = 0;

	// Write file header
	// Magic number: 'icns'
	uint8[offset++] = 0x69; // 'i'
	uint8[offset++] = 0x63; // 'c'
	uint8[offset++] = 0x6E; // 'n'
	uint8[offset++] = 0x73; // 's'

	// File length (big-endian)
	view.setUint32(offset, totalSize, false);
	offset += 4;

	const textEncoder = new TextEncoder();

	// Write icon elements
	for (const entry of entries) {
		// Write OSType (4 bytes)
		const typeBytes = textEncoder.encode(entry.type);
		uint8.set(typeBytes, offset);
		offset += 4;

		// Write data length (big-endian): 8 (header) + data length
		const elementSize = 8 + entry.data.length;
		view.setUint32(offset, elementSize, false);
		offset += 4;

		// Write image data
		uint8.set(entry.data, offset);
		offset += entry.data.length;
	}

	return uint8;
}

/**
 * Get the recommended icon sizes for a complete ICNS file
 * Returns sizes in descending order (largest first)
 */
export function getRecommendedSizes(): IconType[] {
	return [
		'ic10', // 1024x1024 (512@2x)
		'ic14', // 512x512 (256@2x)
		'ic09', // 512x512
		'ic13', // 256x256 (128@2x)
		'ic08', // 256x256
		'ic12', // 64x64 (32@2x)
		'ic07', // 128x128
		'ic11', // 32x32 (16@2x)
	];
}
