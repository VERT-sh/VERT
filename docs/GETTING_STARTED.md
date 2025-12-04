## Getting Started

This file covers how to get started with VERT.

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running Locally](#running-locally)
- [Building for Production](#building-for-production)
- [Using Docker](#using-docker)

### Prerequisites

Make sure you have the following installed:
- [Bun](https://bun.sh/)

### Installation

First, clone the repository:
```sh
git clone https://github.com/VERT-sh/VERT
cd VERT/
```

Install dependencies:
```sh
bun i
```

And finally, make sure you create a `.env` file in the root of the project. We've included a [`.env.example`](../.env.example) file which you can use to get started.

### Running Locally

To run the project locally, run `bun dev`.

This will start a development server. Open your browser and navigate to `http://localhost:5173` to see the application.

### Building for Production

To build the project for production, run `bun run build`.

This will build the site to the `build` folder. You should then use a web server like [nginx](https://nginx.org) to serve the files inside that folder.

### Using Docker

Check the dedicated [Docker](./DOCKER.md) page.