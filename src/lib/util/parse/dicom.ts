import dicomts, { Renderer } from "dicom.ts";

type DicomRenderer = {
	render(image: unknown, frameNo?: number): Promise<void>;
	destroy(): void;
};

export const renderDicomToPng = async (input: Uint8Array) => {
	const image = dicomts.parseImage(
		new DataView(input.buffer, input.byteOffset, input.byteLength),
	) as { columns: number; rows: number } | null;
	if (!image) throw new Error("Failed to parse DICOM image");

	const canvas = new OffscreenCanvas(image.columns, image.rows);
	const renderer = new Renderer(
		canvas as unknown as HTMLCanvasElement,
	) as unknown as DicomRenderer;

	try {
		await renderer.render(image, 0);
		return new Uint8Array(
			await (await canvas.convertToBlob({ type: "image/png" })).arrayBuffer(),
		);
	} finally {
		renderer.destroy();
	}
};
