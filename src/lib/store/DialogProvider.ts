import type { Component } from "svelte";
import { writable } from "svelte/store";

type DialogType = "success" | "error" | "info" | "warning";

type BaseDialog = {
	id: number;
	title: string;
	buttons: {
		text: string;
		action: () => void;
	}[];
	type: DialogType;
};

export type StringDialog = BaseDialog & {
	message: string;
};

export type ComponentDialog<T = unknown> = BaseDialog & {
	message: Component<DialogProps<T>>;
	additional: T;
};

export type Dialog<T = unknown> = StringDialog | ComponentDialog<T>;

export type DialogProps<T = unknown> = {
	id: number;
	title: string;
	type: DialogType;
	buttons: {
		text: string;
		action: () => void;
	}[];
	additional: T;
};

const dialogs = writable<Dialog[]>([]);

let dialogId = 0;

function addDialog(
	title: string,
	message: string | Component<DialogProps>,
	buttons: BaseDialog["buttons"],
	type: DialogType,
	additional?: unknown,
): number {
	const id = dialogId++;

	if (typeof message === "string") {
		const newDialog: StringDialog = {
			id,
			title,
			message,
			buttons,
			type,
		};
		dialogs.update((currentDialogs) => [...currentDialogs, newDialog]);
	} else {
		const newDialog: ComponentDialog = {
			id,
			title,
			message,
			buttons,
			type,
			additional,
		};
		dialogs.update((currentDialogs) => [...currentDialogs, newDialog]);
	}

	return id;
}

function removeDialog(id: number) {
	dialogs.update((currentDialogs) =>
		currentDialogs.filter((dialog) => dialog.id !== id),
	);
}

export { dialogs, addDialog, removeDialog };
