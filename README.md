# Ant Atlas

An app to see everything UCI – all in one place.

[About the Project](https://awesome-e.dev/projects/ant-atlas): Ant Atlas was originally written in 2022 as a way to present UCI campus information in a dead-simple format, making it optimal for reading while on the move.

The frontend is now written in SolidJS and uses Bun as its runtime.

## Local Development

1. Clone the repo
2. Copy `.env.example` to `.env`
3. `bun install` to install dependencies
4. `bun dev` to run the app in development mode

Optionally, [set up Oxc](https://oxc.rs/docs/guide/usage/linter/editors.html) for your editor of choice

## Creating a Build

`bun run build` will build the app for production to the `dist` folder.

It bundles SolidJS in production mode and optimizes the build for the best performance.

## Deployment

Ant Atlas is deployed using GitHub Pages using the [GitHub Pages Deploay Action](https://github.com/jamesives/github-pages-deploy-action). The workflow file is located in [`.github/workflows/pages-deploy.yml`](https://github.com/Awesome-E/viters-atlas/blob/main/.github/workflows/pages-deploy.yml).

## Contributing

Feel free; you can just build things!
