import { ip, type IpInfo } from "$lib/ip";
import { Settings } from "./index.svelte";
import { PUB_VERTD_URL } from "$env/static/public";

const LOCATIONS = [
	{
		latitude: 49.0976,
		longitude: 12.4869,
		url: "https://eu.vertd.vert.sh",
	},
	{
		latitude: 47.6587,
		longitude: -117.426,
		url: "https://usa.vertd.vert.sh",
	},
];

const toRad = (value: number) => (value * Math.PI) / 180;
const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
	const R = 6371; // km
	const dLat = toRad(lat2 - lat1);
	const dLon = toRad(lon2 - lon1);
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(toRad(lat1)) *
			Math.cos(toRad(lat2)) *
			Math.sin(dLon / 2) *
			Math.sin(dLon / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	const d = R * c;
	return d;
};

export type VertdInner =
	| { type: "auto" }
	| { type: "eu" }
	| { type: "us" }
	| { type: "custom" };

export class VertdInstance {
	public static instance = new VertdInstance();

	private cachedIp = $state<IpInfo | null>(null);

	private inner = $state<VertdInner>({
		type: "auto",
	});

	public save() {
		localStorage.setItem("vertdInstance", JSON.stringify(this.inner));
	}

	public load() {
		const ls = localStorage.getItem("vertdInstance");

		// if custom vertd url and no saved setting, default to the custom url
		if (!ls) {
			const isCustomUrl =
				PUB_VERTD_URL && PUB_VERTD_URL !== "https://vertd.vert.sh";
			if (isCustomUrl) {
				this.inner = { type: "custom" };
				return;
			}
		}

		if (!ls) return;
		const inner: VertdInner = JSON.parse(ls);
		this.inner = {
			...this.inner,
			...inner,
		};
	}

	public innerData() {
		return this.inner;
	}

	public set(inner: VertdInner) {
		this.inner = inner;
		this.save();
	}

	public async url() {
		switch (this.inner.type) {
			case "auto": {
				if (!this.cachedIp) {
					this.cachedIp = await ip();
				}

				return this.geographicallyOptimalInstance(this.cachedIp);
			}

			case "eu": {
				return "https://eu.vertd.vert.sh";
			}

			case "us": {
				return "https://usa.vertd.vert.sh";
			}

			case "custom": {
				return Settings.instance.settings.vertdURL;
			}
		}
	}

	private geographicallyOptimalInstance(ip: IpInfo) {
		let bestLocation = LOCATIONS[0];
		let bestDistance = haversine(
			ip.latitude,
			ip.longitude,
			bestLocation.latitude,
			bestLocation.longitude,
		);

		for (let i = 1; i < LOCATIONS.length; i++) {
			const location = LOCATIONS[i];
			const distance = haversine(
				ip.latitude,
				ip.longitude,
				location.latitude,
				location.longitude,
			);
			if (distance < bestDistance) {
				bestDistance = distance;
				bestLocation = location;
			}
		}

		return bestLocation.url;
	}
}
