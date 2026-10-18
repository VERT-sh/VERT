<script lang="ts">
	import type { Snippet } from "svelte";

	type Props = {
		class?: string;
		children: Snippet<[]>;
	};

	const { class: classList, children }: Props = $props();
</script>

<div class="bg-panel {classList} rounded-2.5xl p-3 shadow-panel">
	{@render children?.()}
</div>
