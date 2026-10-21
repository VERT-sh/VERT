## Deploying VERT on Vercel

### 1. Click the Vercel Deploy Button

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/VERT-sh/VERT&project-name=VERT&repository-name=VERT)

### 2. Configure build settings

| Setting            | Value          |
|-------------------|-----------------|
| Framework Preset   | `SvelteKit`    |
| Build Command      | `bun run build`|
| Output Directory   | `build`        |
| Install Command    | `bun install`  |

### 3. Set environment variables

| Variable                            | Example Value                   | Description |
|-------------------------------------|---------------------------------|------------|
| `PUB_ENV`                           | `production`                    | Application environment (required for SvelteKit static build) |
| `PUB_HOSTNAME`                      | `vert.sh`                       | Hostname for analytics tracking |
| `PUB_PLAUSIBLE_URL`                 | `https://plausible.example.com` | Plausible Analytics URL (leave empty to disable) |
| `PUB_VERTD_URL`                     | `https://vertd.vert.sh`         | VERT daemon for video conversion |
| `PUB_DISABLE_ALL_EXTERNAL_REQUESTS` | `false`                         | Set `true` to block all external requests |
| `PUB_DISABLE_FAILURE_BLOCKS`        | `false`                         | Set `true` to prevent blocking on repeated video conversion failures |
| `PUB_DONATION_URL`                  | `https://donations.vert.sh`     | Stripe donation URL |
| `PUB_STRIPE_KEY`                    | ``                              | Stripe public key |

### 4. Deploy

Click **Deploy**. Vercel will build the project with SvelteKit using the settings above.  

This method uses Vercel’s native build system and is easy to update and maintain.
