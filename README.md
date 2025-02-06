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

<sup>* Non-local video conversion is planned, but the daemon will be easily self-hostable to maintain privacy and fully local functionality.</sup>

## Getting Started

### Prerequisites

Make sure you have the following installed:

- [Bun](https://bun.sh/)

### Installation
```sh
# Clone the repository
git clone https://github.com/yourusername/vert.git
cd vert
# Install dependencies
bun i
```

### Running Locally

To run the project locally, run `bun dev`.

This will start a development server. Open your browser and navigate to `http://localhost:5173` to see the application.

### Building for Production

Before building for production, make sure you create a `.env` file in the root of the project with the following content:

```sh
PUB_HOSTNAME=vert.sh # change to your domain
PUB_PLAUSIBLE_URL=https://plausible.example.com # can be empty if not using Plausible
```

To build the project for production, run `bun run build`

This will build the site to the `build` folder. You can then start the server with `bun ./build/index.js` and navigate to `http://localhost:3000` to see the application.

### With Docker

Clone the repository, then build a Docker image with:
```shell
$ docker build -t not-nullptr/vert \
	--build-arg PUB_HOSTNAME=vert.sh \
	--build-arg PUB_PLAUSIBLE_URL=https://plausible.example.com .
```

You can then run it by using:
```shell
$ docker run --restart unless-stopped -p 3000:3000 -d --name "vert" not-nullptr/vert
```

We also have a `docker-compose.yml` file available. Use `docker compose up` if you want to start the stack, or `docker compose down` to bring it down. You can pass `--build` to `docker compose up` to rebuild the Docker image (useful if you've changed any of the environment variables) as well as `-d` to start it in dettached mode. You can read more about Docker Compose in general [here](https://docs.docker.com/compose/intro/compose-application-model/).

## License

This project is licensed under the AGPL-3.0 License, please see the [LICENSE](LICENSE) file for details.
