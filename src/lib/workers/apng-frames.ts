import ffmpegWasm from "@ffmpeg/core/wasm?url";
import ffmpegCore from "@ffmpeg/core?url";
import { FFmpeg } from "@ffmpeg/ffmpeg";

export async function* decodeApngFrames(data: Uint8Array) {
	const ffmpeg = new FFmpeg();
	try {
		await ffmpeg.load({
			coreURL: new URL(ffmpegCore, import.meta.url).href,
			wasmURL: new URL(ffmpegWasm, import.meta.url).href,
		});
		await ffmpeg.writeFile("input.apng", data);

		const exitCode = await ffmpeg.exec([
			"-i",
			"input.apng",
			"-map",
			"0:v:0",
			"-fps_mode",
			"passthrough",
			"-c:v",
			"png",
			"frame%08d.png",
		]);
		if (exitCode !== 0) throw new Error("Could not decode APNG frames");

		const names = (await ffmpeg.listDir("/"))
			.map(({ name }) => name)
			.filter((name) => /^frame\d+\.png$/.test(name))
			.sort();

		if (!names.length) throw new Error("No APNG frames found");

		for (const name of names) {
			const frame = await ffmpeg.readFile(name);
			if (typeof frame === "string")
				throw new Error("Invalid APNG frame");
			await ffmpeg.deleteFile(name);

			yield frame;
		}
	} finally {
		ffmpeg.terminate();
	}
}
