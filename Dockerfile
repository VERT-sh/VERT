# Use the oven/bun image as the build stage
FROM oven/bun AS builder

# Set working directory inside the container
WORKDIR /app

# Declare build arguments (for environment variables to be passed in during build)
ARG PUB_ENV
ARG PUB_HOSTNAME
ARG PUB_PLAUSIBLE_URL
ARG PUB_VERTD_URL
ARG PUB_DISABLE_ALL_EXTERNAL_REQUESTS
ARG PUB_DONATION_URL
ARG PUB_STRIPE_KEY

# Set environment variables inside the container using ARG values
ENV PUB_ENV=${PUB_ENV}
ENV PUB_HOSTNAME=${PUB_HOSTNAME}
ENV PUB_PLAUSIBLE_URL=${PUB_PLAUSIBLE_URL}
ENV PUB_VERTD_URL=${PUB_VERTD_URL}
ENV PUB_DISABLE_ALL_EXTERNAL_REQUESTS=${PUB_DISABLE_ALL_EXTERNAL_REQUESTS}
ENV PUB_DONATION_URL=${PUB_DONATION_URL}
ENV PUB_STRIPE_KEY=${PUB_STRIPE_KEY}

# Copy only package.json to leverage cached layer for dependencies
COPY package.json ./

# Install dependencies using bun package manager
RUN bun install

# Copy the rest of the application files
COPY . ./

# Build the application (usually producing a production-ready bundle)
RUN bun run build

# Use nginx stable alpine image as the final stage for serving static files
FROM nginx:stable-alpine

# Open port 80 for HTTP traffic
EXPOSE 80/tcp

# Copy custom nginx configuration into the container
COPY ./nginx/default.conf /etc/nginx/conf.d/default.conf

# Copy the built application from the builder stage to nginx's html directory
COPY --from=builder /app/build /usr/share/nginx/html

# Define a healthcheck to ensure the nginx server is responsive
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
	CMD curl --fail --silent --output /dev/null http://localhost || exit 1
