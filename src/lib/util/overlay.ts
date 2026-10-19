export type OverlayLayer = {
	contains: (target: Node) => boolean;
	dismiss: () => void;
	modal?: boolean;
};

type OverlayEntry = OverlayLayer & { token: symbol };

const layers: OverlayEntry[] = [];

let listening = false;

const handleClick = (event: MouseEvent) => {
	if (layers.length === 0) return;

	const target = event.target;
	if (!(target instanceof Node)) return;

	for (const layer of [...layers].reverse()) {
		if (layer.contains(target)) return;

		layer.dismiss();

		// modals visually cover the overlays below them, so don't cascade further
		if (layer.modal) return;
	}
};

const setListening = (active: boolean) => {
	if (active === listening || typeof window === "undefined") return;

	listening = active;
	if (active) window.addEventListener("click", handleClick, true);
	else window.removeEventListener("click", handleClick, true);
};

export const pushOverlayLayer = (layer: OverlayLayer): symbol => {
	const token = Symbol("overlay-layer");
	layers.push({ ...layer, token });
	setListening(true);
	return token;
};

export const popOverlayLayer = (token: symbol): void => {
	const index = layers.findIndex((layer) => layer.token === token);
	if (index !== -1) layers.splice(index, 1);
	setListening(layers.length > 0);
};

export const isTopOverlayLayer = (token: symbol): boolean =>
	layers.length > 0 && layers[layers.length - 1].token === token;
