#!/bin/bash

# VERT Docker Setup Script
# This script clones VERT, builds a Docker image, and runs it.

# Configuration
REPO_URL="https://github.com/VERT-sh/VERT"
IMAGE_NAME="vert-sh/vert"
CONTAINER_NAME="vert"
HOST_PORT=3000
CONTAINER_PORT=80

# Build-time environment variables
PUB_ENV="production"
PUB_HOSTNAME="vert.sh"
PUB_PLAUSIBLE_URL="https://plausible.example.com"
PUB_VERTD_URL="https://vertd.vert.sh"
PUB_DONATION_URL="https://donations.vert.sh"
PUB_DISABLE_ALL_EXTERNAL_REQUESTS="false"
PUB_STRIPE_KEY=""

# Choose mode: "build" to build from repo, "pull" to use GitHub Container Registry
MODE="build"

if [[ "$MODE" == "build" ]]; then
    echo "Cloning repository..."
    git clone "$REPO_URL"
    cd VERT || { echo "Failed to enter VERT directory"; exit 1; }

    echo "Building Docker image..."
    docker build -t "$IMAGE_NAME" \
        --build-arg PUB_ENV="$PUB_ENV" \
        --build-arg PUB_HOSTNAME="$PUB_HOSTNAME" \
        --build-arg PUB_PLAUSIBLE_URL="$PUB_PLAUSIBLE_URL" \
        --build-arg PUB_VERTD_URL="$PUB_VERTD_URL" \
        --build-arg PUB_DONATION_URL="$PUB_DONATION_URL" \
        --build-arg PUB_DISABLE_ALL_EXTERNAL_REQUESTS="$PUB_DISABLE_ALL_EXTERNAL_REQUESTS" \
        --build-arg PUB_STRIPE_KEY="$PUB_STRIPE_KEY" \
        .

elif [[ "$MODE" == "pull" ]]; then
    echo "Pulling prebuilt image from GitHub Container Registry..."
    IMAGE_NAME="ghcr.io/vert-sh/vert:latest"
    docker pull "$IMAGE_NAME"
else
    echo "Invalid MODE. Use 'build' or 'pull'."
    exit 1
fi

# Stop and remove existing container if it exists
if docker ps -a --format '{{.Names}}' | grep -Eq "^${CONTAINER_NAME}\$"; then
    echo "Stopping existing container..."
    docker stop "$CONTAINER_NAME"
    echo "Removing existing container..."
    docker rm "$CONTAINER_NAME"
fi

# Run container
echo "Running container..."
docker run -d \
    --restart unless-stopped \
    -p "$HOST_PORT":"$CONTAINER_PORT" \
    --name "$CONTAINER_NAME" \
    "$IMAGE_NAME"

echo "VERT is now running on port $HOST_PORT!"
