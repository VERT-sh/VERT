<script lang="ts" module>
	export interface Donor {
		name: string;
		amount: number;
		avatar: string;
	}
</script>

<script lang="ts">
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import { PUB_DONATION_URL, PUB_STRIPE_KEY } from "$app/env/public";
	// please do not change these!
	const OFFICIAL_DONATION_URL = atob("aHR0cHM6Ly9kb25hdGlvbnMudmVydC5zaA==");
	const OFFICIAL_STRIPE_KEY = atob(
		"cGtfbGl2ZV81MVRsclBhRlRQamtoRUdCU3U1S3d5NWpKUVl4Y1g1eVVVSFhpSDVnN1h6dmIwTkt6RHFib29jMTI2SGpsVzM1dVVrZkFnUU4ycnVFb0N1eVF5bm94cEthQTAwb2pGZ1ExMTY=",
	);
	const isOfficial =
		PUB_DONATION_URL === OFFICIAL_DONATION_URL &&
		PUB_STRIPE_KEY === OFFICIAL_STRIPE_KEY;

	// import { PUB_STRIPE_KEY, PUB_DONATION_API } from "$env/static/public";
	import { fade } from "#lib/util/animation";
	import FancyInput from "#lib/components/functional/FancyInput.svelte";
	import Panel from "#lib/components/visual/Panel.svelte";
	import { effects, link, sanitize } from "#lib/store/index.svelte";
	import { loadStripe } from "@stripe/stripe-js/pure";
	import { type Stripe, type StripeElements } from "@stripe/stripe-js";
	import clsx from "clsx";
	import {
		CalendarHeartIcon,
		HandCoinsIcon,
		HeartIcon,
		WalletIcon,
	} from "@lucide/svelte";
	import { onMount } from "svelte";
	import { Elements, PaymentElement } from "svelte-stripe";
	import { quintOut } from "svelte/easing";
	import { m } from "#lib/paraglide/messages";
	import { ToastManager } from "#lib/util/toast.svelte";
	import { log } from "#lib/util/logger.svelte";

	let amount = $state(1);
	let customAmount = $state("");
	let type = $state("one-time");
	let stripe = $state<Stripe | null>(null);

	const presetAmounts = [1, 10, 25];

	let paymentState = $state<"prepay" | "fetching" | "details">("prepay");
	let enablePay = $state(false);
	let clientSecret = $state<string | null>(null);
	let elements: StripeElements | undefined = $state();

	const amountClick = (preset: number) => {
		amount = preset;
		customAmount = "";
	};

	const paymentClick = async () => {
		if (paymentState !== "prepay") return;

		if (!stripe) stripe = await loadStripe(PUB_STRIPE_KEY);

		paymentState = "fetching";
		const res = await fetch(`${PUB_DONATION_URL}/billing`, {
			method: "POST",
			body: (amount * 100).toString(),
		});

		if (!res.ok) {
			paymentState = "prepay";
			ToastManager.add({
				type: "error",
				message: m["about.donate.payment_error"](),
			});
			return;
		}

		const { data }: { data: string } = await res.json();
		clientSecret = data;
		paymentState = "details";
	};

	$effect(() => {
		if (customAmount) {
			amount = parseFloat(customAmount);
		}
	});

	const payDuration = 400;
	const transition = "cubic-bezier(0.23, 1, 0.320, 1)";

	onMount(async () => {
		if (!isOfficial) {
			log(
				["about", "donate"],
				"donations are being sent to an unofficial VERT instance - PUB_DONATION_URL and/or PUB_STRIPE_KEY have been changed.",
			);
		} else {
			log(
				["about", "donate"],
				"donations are being sent to the official VERT instance.",
			);
		}
	});

	const donate = async () => {
		if (!stripe || !clientSecret || !elements) return;

		enablePay = false;

		const submitResult = await elements.submit();
		if (submitResult.error) {
			const period = submitResult.error.message?.endsWith(".") ? "" : ".";
			ToastManager.add({
				type: "error",
				message: m["about.donate.payment_failed"]({
					message: submitResult.error.message || "",
					period,
				}),
			});
			enablePay = true;
			return;
		}

		const res = await stripe.confirmPayment({
			elements,
			clientSecret,
			redirect: "if_required",
			confirmParams: {
				return_url: page.url.toString(),
			},
		});

		if (res.error) {
			const period = res.error.message?.endsWith(".") ? "" : ".";
			ToastManager.add({
				type: "error",
				message: m["about.donate.payment_failed"]({
					message: res.error.message || "",
					period,
				}),
			});
		} else {
			ToastManager.add({
				type: "info",
				message: m["about.donate.thank_you"](),
			});
		}

		paymentState = "prepay";
		clientSecret = null;
		elements = undefined;
		amount = 1;
		customAmount = "";
		type = "one-time";
		enablePay = false;

		stripe = await loadStripe(PUB_STRIPE_KEY);
	};

	onMount(() => {
		const status = page.url.searchParams.get("redirect_status");
		if (status) {
			switch (status) {
				case "succeeded":
					ToastManager.add({
						type: "success",
						message: m["about.donate.thank_you"](),
					});
					break;
				default:
					ToastManager.add({
						type: "error",
						message: m["about.donate.donation_error"](),
					});
			}

			goto("/about");
		}
	});
</script>

<Panel class="flex flex-col gap-8 p-6">
	<div class="flex flex-col gap-3">
		<h2 class="flex items-center text-2xl font-bold">
			<div
				class="mr-3 inline-block h-10 w-10 rounded-full bg-accent-red p-2"
			>
				<HeartIcon color="black" />
			</div>
			{m["about.donate.title"]()}
		</h2>
		<p class="text-base font-normal">
			{m["about.donate.description"]()}
		</p>
	</div>

	<div
		class="flex w-full flex-col gap-3 overflow-visible"
		style:height="{paymentState !== 'prepay' ? 0 : 124}px"
		style:transform="scaleY({paymentState !== 'prepay' ? 0 : 1})"
		style:opacity={paymentState !== "prepay" ? 0 : 1}
		style:filter="blur({paymentState !== 'prepay' ? 4 : 0}px)"
		style:transition="height {payDuration}ms {transition}, opacity {payDuration -
			200}ms {transition}, transform {payDuration}ms {transition}, filter {payDuration}ms
		{transition}"
	>
		<div class="flex w-full gap-3">
			<button
				onclick={() => (type = "one-time")}
				class={clsx(
					"btn flex flex-1 items-center justify-center rounded-lg p-4",
					{
						"!scale-100": !$effects,
						"bg-accent-red text-black": type === "one-time",
					},
				)}
			>
				<HandCoinsIcon size="24" class="mr-2 inline-block" />
				{m["about.donate.one_time"]()}
			</button>

			<button
				disabled
				onclick={() => (type = "monthly")}
				class={clsx(
					"btn flex flex-1 items-center justify-center rounded-lg p-4",
					{
						"!scale-100": !$effects,
						"bg-accent-red text-black": type === "monthly",
					},
				)}
			>
				<CalendarHeartIcon size="24" class="mr-2 inline-block" />
				{m["about.donate.monthly"]()}
			</button>
		</div>
		<div class="grid w-full grid-cols-4 gap-3">
			{#each presetAmounts as preset, i (preset)}
				<button
					onclick={() => amountClick(preset)}
					class={clsx(
						"btn flex items-center justify-center rounded-lg p-4",
						{
							"!scale-100": !$effects,
							"bg-accent-red text-black": amount === preset,
						},
					)}
					style:grid-column={i === 2 ? "3" : null}
				>
					${preset} USD
				</button>
			{/each}
			<div class="flex items-center justify-center">
				<FancyInput
					bind:value={customAmount}
					placeholder={m["about.donate.custom"]()}
					prefix="$"
					type="number"
					class="h-full"
				/>
			</div>
		</div>
	</div>

	<div class="flex w-full flex-row justify-center">
		<div
			role="button"
			tabindex="0"
			onkeydown={(e) => {
				if (e.key === "Enter") {
					paymentClick();
				}
			}}
			onclick={paymentClick}
			class={clsx(
				"btn relative h-14 flex-1 rounded-3xl border-2 border-accent-red bg-accent-red p-3 text-black",
				{
					"-mb-2 -mt-10 h-[450px] !scale-100 cursor-auto rounded-2xl bg-transparent":
						paymentState !== "prepay",
					"!scale-100": !$effects,
				},
			)}
			style="transition: height {payDuration}ms {transition}, border-radius {payDuration}ms {transition}, background-color {payDuration}ms {transition}, transform {payDuration}ms {transition}, margin {payDuration}ms {transition}; will-change: height, border-radius, background-color, transform, margin;"
		>
			<div class="grid h-full w-full grid-cols-1 grid-rows-1">
				{#if paymentState !== "prepay"}
					<div
						transition:fade={{
							duration: payDuration,
							easing: quintOut,
						}}
						class="col-start-1 row-start-1 flex h-full w-full flex-col gap-4"
					>
						<div
							class="max-h-full flex-grow overflow-y-auto overflow-x-hidden"
						>
							{#if stripe && clientSecret}
								<Elements {stripe} {clientSecret} bind:elements>
									<PaymentElement
										onchange={(e) => {
											enablePay = e.complete;
										}}
									/>
								</Elements>
							{/if}
						</div>

						<div class="flex-shrink-0">
							<button
								disabled={!stripe ||
									!clientSecret ||
									!enablePay}
								class="btn mt-4 h-12 w-full rounded-full bg-accent-red text-black"
								onclick={donate}
							>
								{m["about.donate.donate_amount"]({
									amount: amount.toFixed(2),
								})}
							</button>
						</div>
					</div>
				{:else}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						transition:fade={{
							duration: payDuration,
							easing: quintOut,
						}}
						onclick={paymentClick}
						class="col-start-1 row-start-1 flex items-center justify-center"
					>
						<WalletIcon size="24" class="mr-2 inline-block" />
						{m["about.donate.pay_now"]()}
					</div>
				{/if}
			</div>
		</div>
	</div>

	<p class="text-sm font-normal text-muted">
		{#if isOfficial}
			{m["about.donate.donation_notice_official"]()}
		{:else}
			{@html sanitize(
				link(
					"official_link",
					m["about.donate.donation_notice_unofficial"](),
					"https://vert.sh",
					true,
					"",
				),
			)}
		{/if}
	</p>
</Panel>
