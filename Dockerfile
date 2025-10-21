# Stage 1: Build the application using the bun container
FROM oven/bun AS builder

# Set the working directory inside the container
WORKDIR /app

# Build-time arguments (do NOT include secrets here)
ARG PUB_ENV
ARG PUB_HOSTNAME
ARG PUB_PLAUSIBLE_URL
ARG PUB_DISABLE_ALL_EXTERNAL_REQUESTS
ARG PUB_DONATION_URL
ARG PUB_STRIPE_KEY

# Expose ARGs as environment variables during build
ENV PUB_ENV=${PUB_ENV} \
    PUB_HOSTNAME=${PUB_HOSTNAME} \
    PUB_PLAUSIBLE_URL=${PUB_PLAUSIBLE_URL} \
    PUB_DISABLE_ALL_EXTERNAL_REQUESTS=${PUB_DISABLE_ALL_EXTERNAL_REQUESTS} \
    PUB_DONATION_URL=${PUB_DONATION_URL} \
    PUB_STRIPE_KEY=${PUB_STRIPE_KEY}

# Copy dependency manifest files first (for efficient caching)
COPY package.json ./        # Node dependencies manifest
COPY bun.lockb ./           # Bun lockfile

# Install dependencies
RUN bun install

# Copy source files
COPY . ./ 

# Run build script to create production assets
RUN bun run build

# Stage 2: Serve static files with Nginx
FROM nginx:stable-alpine

# Add labels for source and maintainer info
LABEL org.opencontainers.image.source="https://github.com/VERT-sh/VERT" \
      maintainer="VERT-sh"

# Expose port 80
EXPOSE 80/tcp

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy custom nginx configuration if exists
COPY ./nginx/default.conf /etc/nginx/conf.d/default.conf

# Copy build output from previous stage to nginx's serving directory
COPY --from=builder /app/build /usr/share/nginx/html

# Change ownership to nginx user for proper permission handling
RUN chown -R nginx:nginx /usr/share/nginx/html

# Define a simple HTTP healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl --fail --silent --output /dev/null http://127.0.0.1/ || exit 1

# Use nginx's default command to start serving
