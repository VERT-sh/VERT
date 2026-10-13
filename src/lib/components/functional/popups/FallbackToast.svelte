<script lang="ts">
	import { m } from "#lib/paraglide/messages";

	type Additional = {
		filename: string;
		nextConverter: string;
		onNext: () => void | Promise<void>;
		onCancel: () => void;
	};

	let { additional }: { additional: Additional } = $props();

	export const title = m["convert.errors.converter_fallback.title"]();
</script>

<div class="flex flex-col gap-4">
	<p class="text-black">
		{m["convert.errors.converter_fallback.body"]({
			filename: additional.filename,
			converter: additional.nextConverter,
		})}
	</p>
	<div class="flex gap-4">
		<button
			class="btn h-fit w-full rounded-lg py-2"
			onclick={() => additional.onCancel()}
		>
			{m["convert.errors.converter_fallback.no"]()}
		</button>
		<button
			class="btn h-fit w-full rounded-lg bg-accent-blue py-2 text-black"
			onclick={() => additional.onNext()}
		>
			{m["convert.errors.converter_fallback.yes"]()}
		</button>
	</div>
</div>
