<script lang="ts">
	import type { Snippet } from "svelte";

	type Props = {
		class?: string;
		children: Snippet<[]>;
	};

	const { class: classList, children }: Props = $props();
</script>

<div class="bg-panel {classList} p-3 rounded-2.5xl shadow-panel">
	{@render children?.()}
</div>
