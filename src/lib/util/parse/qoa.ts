// @ts-expect-error - no types for qoa-format
import { encode, decode } from "qoa-format";

export type QoaPcmData = {
	sampleRate: number;
	channels: number;
	pcm: Uint8Array;
};

// decodes to PCM
export const decodeQoa = (input: Uint8Array): QoaPcmData => {
	const decoded = decode(input);
	const pcm = interleaveChannelData(decoded.channelData);

	return {
		sampleRate: decoded.sampleRate,
		channels: decoded.channels,
		pcm,
	};
};

// encodes from PCM
export const encodeQoa = (
	pcm: Uint8Array,
	sampleRate: number,
	channels: number,
): Uint8Array => {
	const channelData = deinterleavePcm(pcm, channels);
	return encode({ sampleRate, channelData });
};

// encodes from PCM to WAV
export const encodeWav = (
	pcm: Uint8Array,
	sampleRate: number,
	channels: number,
	float32 = true,
): Uint8Array => {
	// WAV header (RIFF) for IEEE float (format 3) or PCM (format 1)
	const bitsPerSample = float32 ? 32 : 16;
	const bytesPerSample = bitsPerSample / 8;
	const blockAlign = channels * bytesPerSample;
	const byteRate = sampleRate * blockAlign;

	const dataLength = pcm.byteLength;
	const headerSize = 44;
	const buffer = new ArrayBuffer(headerSize + dataLength);
	const view = new DataView(buffer);
	let offset = 0;

	// RIFF identifier
	writeString(view, offset, "RIFF");
	offset += 4;
	view.setUint32(offset, 36 + dataLength, true); // file length - 8
	offset += 4;
	writeString(view, offset, "WAVE");
	offset += 4;

	// fmt chunk
	writeString(view, offset, "fmt ");
	offset += 4;
	view.setUint32(offset, 16, true); // fmt chunk length
	offset += 4;
	view.setUint16(offset, float32 ? 3 : 1, true); // audio format: 3 = IEEE float, 1 = PCM
	offset += 2;
	view.setUint16(offset, channels, true);
	offset += 2;
	view.setUint32(offset, sampleRate, true);
	offset += 4;
	view.setUint32(offset, byteRate, true);
	offset += 4;
	view.setUint16(offset, blockAlign, true);
	offset += 2;
	view.setUint16(offset, bitsPerSample, true);
	offset += 2;

	// data chunk
	writeString(view, offset, "data");
	offset += 4;
	view.setUint32(offset, dataLength, true);
	offset += 4;

	// copy pcm bytes
	const uint8 = new Uint8Array(buffer);
	uint8.set(new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength), headerSize);

	return uint8;
};

const writeString = (view: DataView, offset: number, str: string) => {
	for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
};

const interleaveChannelData = (channelData: Float32Array[]) => {
	const channels = channelData.length;
	const samples = channelData[0]?.length ?? 0;
	const interleaved = new Float32Array(samples * channels);

	for (let sample = 0; sample < samples; sample++) {
		for (let channel = 0; channel < channels; channel++) {
			interleaved[sample * channels + channel] =
				channelData[channel]?.[sample] ?? 0;
		}
	}

	return new Uint8Array(interleaved.buffer);
};

const deinterleavePcm = (pcm: Uint8Array, channels: number) => {
	const floatPcm = new Float32Array(
		pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.byteLength),
	);
	const samples = Math.floor(floatPcm.length / channels);
	const channelData = Array.from(
		{ length: channels },
		() => new Float32Array(samples),
	);

	for (let sample = 0; sample < samples; sample++) {
		for (let channel = 0; channel < channels; channel++) {
			channelData[channel][sample] =
				floatPcm[sample * channels + channel] ?? 0;
		}
	}

	return channelData;
};
