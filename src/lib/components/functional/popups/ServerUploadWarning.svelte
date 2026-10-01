<script lang="ts" module>
	import type { DialogProps } from "$lib/store/DialogProvider";

	export interface ServerUploadWarningProps {
		filename: string;
		onDontShowAgainChange: (value: boolean) => void;
	}

	export type Props = DialogProps<ServerUploadWarningProps>;
</script>

<script lang="ts">
	import { m } from "$lib/paraglide/messages";
	import FancyInput from "../FancyInput.svelte";

	let { additional }: Props = $props();
	let dontShowAgain = $state(true);
</script>

<div class="flex flex-col gap-4">
	<p class="text-black dynadark:text-white">
		{m["convert.external_warning.text"]({
			filename: additional.filename,
		})}
	</p>
	<div class="flex items-center gap-2 text-black dynadark:text-white">
		<FancyInput
			type="checkbox"
			checked={dontShowAgain}
			onchange={(event: Event) => {
				const checked = (event.currentTarget as HTMLInputElement)
					.checked;
				dontShowAgain = checked;
				additional.onDontShowAgainChange(checked);
			}}
		/>
		<span>{m["convert.external_warning.dont_show_again"]()}</span>
	</div>
</div>
