# DeepSeek CLI

Command line interface for interacting with the DeepSeek API. This stage establishes the architectural
foundation, tooling, and initial commands for the project.

## Requirements

- Node.js v22 or newer
- pnpm v10 or newer

## Getting Started

1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Copy the example environment variables and set your DeepSeek API key:
   ```bash
   cp .env .env.local # optional custom file
   # edit .env or .env.local
   ```
   Ensure `DEEPSEEK_API_KEY` is defined in your environment before running API commands. The CLI loads
   variables from `.env` automatically.
3. Build the project:
   ```bash
   pnpm build
   ```
4. Link the CLI locally (optional for development):
   ```bash
   pnpm link --global
   ```

## Usage

After building, run commands via the compiled binary:

```bash
node dist/cli/index.js hello
```

Or, when linked globally:

```bash
deepseek hello
```

### Available Commands

- `deepseek hello` — prints `DeepSeek CLI initialized successfully` to confirm setup.
- `deepseek test-api` — sends a `ping` message to the DeepSeek API and prints the response and tokens used.

> **Note:** `deepseek test-api` requires `DEEPSEEK_API_KEY` to be configured. Without the key, the command exits with an error.

## Development Scripts

- `pnpm lint` — run ESLint across the project.
- `pnpm lint:fix` — lint with automatic fixes.
- `pnpm format` — format files with Prettier.
- `pnpm test` — execute Jest (`--passWithNoTests` is enabled during early development).
- `pnpm build` — compile TypeScript sources to `dist/`.

## Project Structure

```
deepseek-cli/
├── src/
│   ├── api/
│   │   └── deepseekClient.ts
│   ├── cli/
│   │   └── index.ts
│   ├── config/
│   │   └── default.json
│   ├── core/
│   │   ├── models/
│   │   └── repository/
│   ├── tui/
│   │   └── components/
│   └── utils/
│       └── logger.ts
├── tests/
├── package.json
├── tsconfig.json
└── README.md
```

The architecture follows a modular, layered approach (core, CLI, TUI, API, utilities) with future expansion
planned for domain-driven modules and UI components.

## Git Hooks

Husky runs lint-staged on each commit to ensure staged files are linted and formatted.

## Testing the API Client

The CLI uses an axios-based client (`DeepSeekClient`) that interacts with the DeepSeek chat completion
endpoint using the configured model and base URL. The client validates responses and surfaces token usage.
