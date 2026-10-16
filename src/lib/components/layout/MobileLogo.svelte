<script>
	import MTULogo from "$lib/components/visual/svg/MTULogo.svelte";
</script>

<div class="flex md:hidden justify-center items-center pb-8 pt-4">
	<a
		class="flex items-center justify-center bg-panel p-2 rounded-[20px] shadow-panel"
		href="/"
		title="MTU Aero Engines Polska"
	>
		<div
			class="h-16 px-8 bg-accent text-on-accent rounded-[16px] flex items-center justify-center"
		>
			<div class="h-11 w-auto flex items-center justify-center">
				<MTULogo class="h-10 w-auto text-white" withDescriptor={true} />
			</div>
		</div>
	</a>
</div>
