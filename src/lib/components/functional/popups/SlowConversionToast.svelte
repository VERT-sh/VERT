<script lang="ts">
	import { m } from "#lib/paraglide/messages";

	type Additional = {
		filename: string;
		converter: string;
		reason: "device" | "timeout";
		onSwitch: () => void | Promise<void>;
		onContinue: () => void;
	};

	let { additional }: { additional: Additional } = $props();

	export const title = m["convert.slow_conversion.title"]();
</script>

<div class="flex flex-col gap-4">
	<p class="text-black">
		{additional.reason === "device"
			? m["convert.slow_conversion.device_body"]({
					filename: additional.filename,
				})
			: m["convert.slow_conversion.timeout_body"]({
					filename: additional.filename,
				})}
	</p>
	<div class="flex gap-4">
		<button
			class="btn rounded-lg h-fit py-2 w-full"
			onclick={additional.onContinue}
		>
			{m["convert.slow_conversion.continue"]()}
		</button>
		<button
			class="btn rounded-lg h-fit py-2 w-full bg-accent-blue text-black"
			onclick={() => additional.onSwitch()}
		>
			{m["convert.slow_conversion.switch"]({
				converter: additional.converter,
			})}
		</button>
	</div>
</div>
