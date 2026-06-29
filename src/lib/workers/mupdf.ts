// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).$libmupdf_wasm_Module = {
	locateFile: () => "/mupdf-wasm.wasm",
};

let mupdf: typeof import("mupdf") | null = null;

self.onmessage = async (e: MessageEvent) => {
	const { file, to, id } = e.data as { file: File; to: string; id: string };
	try {
		if (!mupdf) mupdf = await import("mupdf");

		const buf = new Uint8Array(await file.arrayBuffer());
		const doc = mupdf.Document.openDocument(buf, "application/pdf");
		const pageCount = doc.countPages();
		const parts: string[] = [];

		for (let i = 0; i < pageCount; i++) {
			const page = doc.loadPage(i);
			const st = page.toStructuredText("preserve-whitespace");
			parts.push(st.asText());
			page.destroy();
		}
		doc.destroy();

		self.postMessage({
			type: "finished",
			output: new TextEncoder().encode(parts.join("\n\n")),
			id,
		});
	} catch (err) {
		self.postMessage({ type: "error", error: String(err), id });
	}
};
