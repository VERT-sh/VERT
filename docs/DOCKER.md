## Using Docker

This file covers how to run VERT under a Docker container.

- [Manually building the image](#manually-building-the-image)
- [Using an image from the GitHub Container Registry](#using-an-image-from-the-github-container-registry)

### Manually building the image

First, clone the repository:

```shell
$ git clone https://github.com/VERT-sh/VERT
$ cd VERT/
```

Then build a Docker image with:

```shell
docker build -t vert-sh/vert \
  --build-arg PUB_ENV=production \
  --build-arg PUB_HOSTNAME=vert.sh \
  --build-arg PUB_PLAUSIBLE_URL=https://plausible.example.com \
  --build-arg PUB_VERTD_URL=https://vertd.vert.sh \
  --build-arg PUB_DONATION_URL=https://donations.vert.sh \
  --build-arg PUB_DISABLE_ALL_EXTERNAL_REQUESTS=false \
  --build-arg PUB_STRIPE_KEY="" \
  .
```

You can then run it by using:

```shell
$ docker run -d \
    --restart unless-stopped \
    -p 3000:80 \
    --name "vert" \
    vert-sh/vert
```

This will do the following:

- Use the previously built image as the container `vert`, in detached mode
- Continuously restart the container until manually stopped
- Map `3000/tcp` (host) to `80/tcp` (container)

We also have a [`docker-compose.yml`](/docker-compose.yml) file available. Use `docker compose up` if you want to start the stack, or `docker compose down` to bring it down. You can pass `--build` to `docker compose up` to rebuild the Docker image (useful if you've changed any of the environment variables) as well as `-d` to start it in detached mode. You can read more about Docker Compose in general [here](https://docs.docker.com/compose/intro/compose-application-model/).

### Using an image from the GitHub Container Registry

While there's an image you can pull instead of cloning the repo and building the image yourself, you will not be able to update any of the environment variables (e.g. `PUB_PLAUSIBLE_URL`) as they're baked directly into the image and not obtained during runtime. If you're okay with this, you can simply run this command instead:

```shell
$ docker run -d \
    --restart unless-stopped \
    -p 3000:80 \
    --name "vert" \
    ghcr.io/vert-sh/vert:latest
```
