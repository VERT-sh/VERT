import { browser } from "$app/environment";

export interface IpInfo {
	ip: string;
	network: string;
	version: string;
	city: string;
	region: string;
	region_code: string;
	country: string;
	country_name: string;
	country_code: string;
	country_code_iso3: string;
	country_capital: string;
	country_tld: string;
	continent_code: string;
	in_eu: boolean;
	postal: string;
	latitude: number;
	longitude: number;
	timezone: string;
	utc_offset: string;
	country_calling_code: string;
	currency: string;
	currency_name: string;
	languages: string;
	country_area: number;
	country_population: number;
	asn: string;
	org: string;
}

export const ip = async (): Promise<IpInfo> => {
	try {
		if (browser) {
			const item = localStorage.getItem("ipinfo");
			if (item) {
				return JSON.parse(item);
			}
		}

		const res = await fetch("https://ipapi.co/json/").then((r) => r.json());
		if (browser) {
			localStorage.setItem("ipinfo", JSON.stringify(res));
		}

		return res;
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
	} catch (_) {
		return {
			ip: "127.0.0.1",
			asn: "AS0",
			city: "Localhost",
			continent_code: "NA",
			country: "US",
			country_calling_code: "+1",
			country_capital: "Washington",
			country_code: "US",
			country_code_iso3: "USA",
			country_name: "United States",
			country_population: 0,
			currency: "USD",
			currency_name: "Dollar",
			languages: "en-US,es-US,haw,fr",
			latitude: 0,
			longitude: 0,
			network: "Unknown",
			postal: "00000",
			region: "Local",
			region_code: "LOC",
			country_area: 0,
			timezone: "America/New_York",
			utc_offset: "-0500",
			version: "IPv4",
			in_eu: false,
			org: "Localhost",
			country_tld: ".us",
		};
	}
};
