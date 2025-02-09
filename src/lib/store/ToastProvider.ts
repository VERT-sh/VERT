import { writable } from "svelte/store";

export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
	id: number;
	type: ToastType;
	message: string;
	disappearing: boolean;
	durations: {
		enter: number;
		stay: number;
		exit: number;
	};
}

const toasts = writable<Toast[]>([]);

let toastId = 0;

function addToast(
	type: ToastType,
	message: string,
	disappearing?: boolean,
	durations?: { enter: number; stay: number; exit: number },
) {
	const id = toastId++;

	durations = durations ?? {
		enter: 300,
		stay: disappearing || disappearing === undefined ? 5000 : 86400000, // 24h cause why not
		exit: 500,
	};

	// if "disappearing" not set, default error/warning to infinite duration
	if (disappearing === undefined) {
		switch (type) {
			case "error":
			case "warning":
				durations.stay = 86400000; // 24h cause why not
				break;
		}
	}

	const newToast: Toast = {
		id,
		type,
		message,
		disappearing: disappearing ?? true,
		durations,
	};
	toasts.update((currentToasts) => [...currentToasts, newToast]);

	setTimeout(
		() => {
			removeToast(id);
		},
		durations.enter + durations.stay + durations.exit,
	);
}

function removeToast(id: number) {
	toasts.update((currentToasts) =>
		currentToasts.filter((toast) => toast.id !== id),
	);
}

export { toasts, addToast, removeToast };
