FROM oven/bun AS builder

WORKDIR /app

ARG PUB_ENV
ARG PUB_HOSTNAME
ARG PUB_PLAUSIBLE_URL
ARG PUB_VERTD_URL
ARG PUB_DISABLE_ALL_EXTERNAL_REQUESTS
ARG PUB_DONATION_URL
ARG PUB_STRIPE_KEY

ENV PUB_ENV=${PUB_ENV}
ENV PUB_HOSTNAME=${PUB_HOSTNAME}
ENV PUB_PLAUSIBLE_URL=${PUB_PLAUSIBLE_URL}
ENV PUB_VERTD_URL=${PUB_VERTD_URL}
ENV PUB_DISABLE_ALL_EXTERNAL_REQUESTS=${PUB_DISABLE_ALL_EXTERNAL_REQUESTS}
ENV PUB_DONATION_URL=${PUB_DONATION_URL}
ENV PUB_STRIPE_KEY=${PUB_STRIPE_KEY}

COPY package.json ./

RUN apt-get update && \
	apt-get install -y --no-install-recommends git && \
	rm -rf /var/lib/apt/lists/*

RUN bun install

COPY . ./

RUN bun run build

FROM nginx:stable-alpine

EXPOSE 80/tcp

COPY ./nginx/default.conf /etc/nginx/conf.d/default.conf

COPY --from=builder /app/build /usr/share/nginx/html

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
	CMD curl --fail --silent --output /dev/null http://localhost || exit 1