# Contributing to VERT

Thank you for taking your time to contribute to the `VERT-sh/VERT` repository! VERT uses many other FOSS projects and would not exist without the open source community <3

Below is our guidelines for contributing to this repository, but also note our general contributing guides found here: [CONTRIBUTING.md](https://github.com/VERT-sh/.github/blob/main/profile/CONTRIBUTING.md)

## Conventions

> For all contributions, please note our AI / LLM policy found on our general contributing guide: [CONTRIBUTING.md](https://github.com/VERT-sh/.github/blob/main/profile/CONTRIBUTING.md)

### Code changes

Clone the repository, install its dependencies with Bun, and create a branch for your changes:

```sh
git clone https://github.com/VERT-sh/VERT && cd VERT
bun i
cp .env.example .env
git switch -c your-branch
```

..then run your dev environment with `bun dev`. Before submitting a pull request, run the formatter and linter:

```sh
bun run format
bun run check
bun run lint
```

Please follow these conventions when contributing:

- Git commit messages should follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) standard
- [Bun](https://bun.sh) is used as the NodeJS runtime
- Use [Prettier](https://prettier.io/) to format your code
- Open your pull request after `bun run check` and `bun run lint` pass

### Issues / bugs

To report an issue, either join the VERT Discord server above and open a forum post in the server, or open a GitHub issue on the repository.

Please provide any relevant details, reproduction steps, and screenshots for us to replicate your issue. You may also provide the original file if you are comfortable to do so, publicly or privately (to our team through DMs) - see the general [CONTRIBUTING.md](https://github.com/VERT-sh/.github/blob/main/profile/CONTRIBUTING.md) to contact us.

### Translations

Translations are currently done through [Paraglide JS](https://paraglidejs.com/) which use JSON files. If in doubt, the English translation file ([en.json](https://github.com/VERT-sh/VERT/blob/main/messages/en.json)) should be the main source of truth for translations. The translations do not need to be exact and they can be adapted according to local conventions.

To contribute a language, create a copy of the source language file (`en.json`) and name it the two-letter language code you are translating, according to ISO 639-1 (e.g. Spanish -> `es.json`). For regional language variants, you may use a BCP 47 language tag (e.g. Brazilian Portuguese -> `pt-BR.json`). You will also need to edit these two files to add them into the UI: [settings.json](https://github.com/VERT-sh/VERT/blob/main/project.inlang/settings.json) & [index.svelte.ts](https://github.com/VERT-sh/VERT/blob/main/src/lib/store/index.svelte.ts).

### Documentation

Official documentation for self-hosting, development, and other frequently asked questions are stored in the `/docs` folder of the repo. Our documentation is currently written in English.
