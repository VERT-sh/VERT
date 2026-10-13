<script lang="ts">
	import Toast from "#lib/components/visual/Toast.svelte";
	import { ToastManager } from "#lib/util/toast.svelte";
</script>

<div
	class="fixed bottom-28 right-0 z-50 flex flex-col-reverse gap-4 p-4 md:bottom-0"
>
	{#each ToastManager.toasts as toast (toast.id)}
		<div class="flex justify-end">
			<Toast {toast} />
		</div>
	{/each}
</div>
