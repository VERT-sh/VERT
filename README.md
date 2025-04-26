<p align="center">
  <img src="https://github.com/user-attachments/assets/bf441748-0ec5-4c8a-b3e5-11301ee3f0bd" alt="VERT's logo" height="100">
</p>
<h1 align="center"><a href="https://vert.sh">VERT.sh</a></h1>

VERT is a file conversion utility that uses WebAssembly to convert files on your device instead of a cloud. Check out the live instance at [vert.sh](https://vert.sh).

VERT is built in Svelte and TypeScript.

## Features

- Convert files directly on your device using WebAssembly *
- No file size limits
- Supports multiple file formats
- User-friendly interface built with Svelte

<sup>* Non-local video conversion is available with our official instance, but the [daemon](https://github.com/VERT-sh/vertd) is easily self-hostable to maintain privacy and fully local functionality.</sup>

## Getting Started

### Prerequisites

Make sure you have the following installed:

- [Bun](https://bun.sh/)

### Installation
```sh
# Clone the repository
$ git clone https://github.com/VERT-sh/vert.git
$ cd vert

# Install dependencies
$ bun i
```

### Running Locally

To run the project locally, run `bun dev`.

This will start a development server. Open your browser and navigate to `http://localhost:5173` to see the application.

### Building for Production

Before building for production, make sure you create a `.env` file in the root of the project with the following content:

```sh
PUB_HOSTNAME=example.com # change to your domain, only gets used for Plausible (for now)
PUB_PLAUSIBLE_URL=https://plausible.example.com # can be empty if not using Plausible
PUB_ENV=production # "production", "development" or "nightly"
PUB_VERTD_URL=https://vertd.vert.sh # default vertd instance
```

To build the project for production, run `bun run build`

This will build the site to the `build` folder. You should then use a web server like [nginx](https://nginx.org) to serve the files inside that folder.

If using nginx, you can use the [default-ssl.conf](./nginx/default-ssl.conf) file (or [default.conf](./nginx/default.conf) if you don't need to serve the site over HTTPS) as a starting point. Make sure you keep [cross-origin isolation](https://web.dev/articles/cross-origin-isolation-guide) enabled, which **requires** HTTPS on most cases.

### With Docker

Clone the repository, then build a Docker image with:
```shell
$ docker build -t vert-sh/vert \
	--build-arg PUB_ENV=production \
	--build-arg PUB_HOSTNAME=vert.sh \
	--build-arg PUB_PLAUSIBLE_URL=https://plausible.example.com \
	--build-arg PUB_VERTD_URL=https://vertd.vert.sh .
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

We also have a [`docker-compose.yml`](./docker-compose.yml) file available. Use `docker compose up` if you want to start the stack, or `docker compose down` to bring it down. You can pass `--build` to `docker compose up` to rebuild the Docker image (useful if you've changed any of the environment variables) as well as `-d` to start it in detached mode. Feel free to read more about Docker Compose in general [here](https://docs.docker.com/compose/intro/compose-application-model/).

#### Pulling instead of building

While there's an image you can pull instead of cloning the repo and building the image yourself, you will not be able to update any of the environment variables (e.g. `PUB_PLAUSIBLE_URL`) as they're baked directly into the image and not obtained during runtime. If you're okay with this, you can simply run this command instead:
```shell
$ docker run -d \
	--restart unless-stopped \
	-p 3000:80 \
	--name "vert" \
	ghcr.io/vert-sh/vert:latest
```

#### Serving the site over HTTPS

If you're running the container in your local machine and accessing it from `localhost`, this isn't really required. However, any other origin will cause cross-origin
isolation to be disabled unless you serve the site over HTTPS, which in turn will cause image conversions to fail. There are a few options to get around this:
- Using something like Tailscale's [HTTPS feature](https://tailscale.com/kb/1153/enabling-https)
- Using a self-signed certificate (not recommended for public instances and your browser will likely yell at you)
- Using Let's Encrypt or Cloudflare as a TLS proxy with your own domain

If you want to use a self-signed certificate, there's a little [script](./nginx/setup-self-signed.sh) you can run in order to generate one. Make sure you have `openssl` installed, then run:
```shell
$ cd ./nginx/
$ ./setup-self-signed.sh
```

This will generate the following files inside `./ssl/`:
```shell
$ ls ./ssl
self-signed.crt  self-signed.key
```

If you don't want to use a self-signed certificate, simply copy your own key and certificate files into `./nginx/ssl/` instead. Make sure to then modify the default SSL config under [./nginx/default-ssl.conf](./nginx/default-ssl.conf) to match the file names:
```conf
server {
    ...

    ssl_certificate     /etc/ssl/vert/self-signed.crt;
    ssl_certificate_key /etc/ssl/vert/self-signed.key;

    ...
}
```

Finally, update your Docker Compose configuration:
```yaml
services:
  vert:
    # ...
    ports:
      # map to port 443 instead of 80
      - "${PORT:-3000}:443"
    volumes:
      # map the ssl folder with our certificates to /etc/ssl/vert in read-only mode
      - "./nginx/ssl:/etc/ssl/vert:ro"

      # overwrite the default HTTP configuration of the container
      - "./nginx/default-ssl.conf:/etc/nginx/conf.d/default.conf"
```

For `docker run`, use:
```shell
$ docker run ... \
	-p 3000:443 \
	-v "./nginx/ssl:/etc/ssl/vert" \
	-v "./nginx/default-ssl.conf:/etc/nginx/conf.d/default.conf" \
	...
```

## License

This project is licensed under the AGPL-3.0 License, please see the [LICENSE](LICENSE) file for details.
