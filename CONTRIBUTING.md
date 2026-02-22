# Contributing to Torch Secret

Welcome, and thank you for your interest in contributing to Torch Secret! Whether you're fixing a typo, reporting a bug, or building a new feature -- we appreciate every contribution.

This guide will help you get set up and explain the workflow for making changes.

## Prerequisites

Before you start, make sure you have the following installed:

- **Node.js** 24+ and npm
- **PostgreSQL** 17+ (local installation or Docker)
- **Git**
- **Redis** (optional, only needed for distributed rate limiting)

## Development Setup

1. **Clone the repository:**

   ```bash
   git clone https://github.com/norcalcoop/secureshare.git
   cd secureshare
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Configure environment:**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set `DATABASE_URL` to point to your PostgreSQL instance. See `.env.example` for all available options.

4. **Run database migrations:**

   ```bash
   npm run db:migrate
   ```

5. **Start the dev servers:**

   ```bash
   npm run dev:server    # Backend on :3000
   npm run dev:client    # Frontend on :5173 (proxies /api to :3000)
   ```

   Or use Docker for the full stack:

   ```bash
   docker compose up
   ```

## Code Style

ESLint and Prettier are enforced automatically via pre-commit hooks (Husky + lint-staged). Every commit runs lint and format checks on staged files.

You can also run them manually:

```bash
npm run lint            # Check for lint errors
npm run lint:fix        # Auto-fix lint errors
npm run format:check    # Check formatting
npm run format          # Auto-fix formatting
```

TypeScript strict mode is required. Ensure no type errors before submitting:

```bash
npx tsc --noEmit
```

## Testing

Torch Secret uses [Vitest](https://vitest.dev/) for unit and integration tests, and [Playwright](https://playwright.dev/) for end-to-end tests.

- **Run all tests:**

  ```bash
  npm run test:run
  ```

- **Run E2E tests:** (requires PostgreSQL + Redis)

  ```bash
  npm run test:e2e
  ```

- **Run a specific test file:**

  ```bash
  npx vitest run path/to/test.ts
  ```

Client tests run in a happy-dom environment. Server tests run sequentially against a real PostgreSQL database (not mocks).

## Project Structure

```
secureshare/
├── client/       # Vanilla TypeScript frontend (Vite + Tailwind CSS)
├── server/       # Express 5 API server (Drizzle ORM + PostgreSQL)
├── shared/       # Zod schemas and TypeScript types shared between client and server
├── e2e/          # Playwright end-to-end tests
├── drizzle/      # Database migration files
└── .github/      # CI workflows, issue templates, PR template
```

## Making a Pull Request

1. **Fork** the repository
2. **Create a feature branch:**

   ```bash
   git checkout -b my-feature
   ```

3. **Make your changes** and write tests for new functionality
4. **Run the full quality check:**

   ```bash
   npm run lint && npm run format:check && npm run test:run && npx tsc --noEmit
   ```

5. **Commit** with a clear, descriptive message
6. **Push** and open a pull request against `main`
7. **CI** will automatically run lint, tests, and E2E checks on your PR

The PR template includes a checklist -- please make sure all applicable items are checked before requesting review.

## Reporting Bugs

Found a bug? Please [open an issue](https://github.com/norcalcoop/secureshare/issues/new?template=bug-report.yml) using the Bug Report template. Include steps to reproduce, expected behavior, and any relevant screenshots.

## Security

For security vulnerabilities, please see [SECURITY.md](SECURITY.md). **Do not** file public issues for security concerns -- use GitHub's private vulnerability reporting instead.

## License

By contributing to Torch Secret, you agree that your contributions will be licensed under the project's [ISC License](LICENSE).
