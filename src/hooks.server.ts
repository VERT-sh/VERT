import type { Handle } from "@sveltejs/kit/hooks";
import { paraglideMiddleware } from "#lib/paraglide/server";

// creating a handle to use the paraglide middleware
const paraglideHandle: Handle = ({ event, resolve }) =>
	paraglideMiddleware(
		event.request,
		({ request: localizedRequest, locale }) =>
			resolve(
				{ ...event, request: localizedRequest },
				{
					transformPageChunk: ({ html }) => {
						return html.replace("%lang%", locale);
					},
				},
			),
	);

export const handle: Handle = paraglideHandle;
