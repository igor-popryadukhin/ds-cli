# DeepSeek CLI

Command line interface for interacting with the DeepSeek API with built-in session management, sandboxed
operations, approval flows, and safe patch/command execution utilities.

## Requirements

- Node.js v22 or newer
- pnpm v10 or newer

## Getting Started

1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Configure environment variables. At minimum export your DeepSeek API key:
   ```bash
   export DEEPSEEK_API_KEY=<your-key>
   ```
   The CLI automatically loads variables from `.env` if present.
3. Build the project:
   ```bash
   pnpm build
   ```
4. (Optional) Link the CLI globally during development:
   ```bash
   pnpm link --global
   ```

## Usage

Run commands directly from the compiled output:

```bash
node dist/cli/index.js <command>
```

Or, after linking:

```bash
deepseek <command>
```

### Interactive Chat & Sessions

- `deepseek chat` — start an interactive terminal chat using the configured model. Sessions and messages are
  persisted in the configured history directory.
- `deepseek resume [id]` — resume a specific session by ID.
- `deepseek resume --last` — resume the most recent session snapshot.

### Sandbox Management

- `deepseek sandbox get` — print the current sandbox configuration.
- `deepseek sandbox set <read-only|workspace-write|danger-full-access>` — change sandbox mode. The change is
  persisted to `.deepseek/config.json` and recorded in history.

### Approval Policies

- `deepseek approvals get` — print the current approval policy.
- `deepseek approvals set <untrusted|on-failure|on-request|never>` — update approval policy and log the change.

### Safe Patch Application

- `deepseek patch apply --file <diff>` — preview and apply a unified diff. Use `--yes` to auto-approve and
  `--json` to emit machine-readable events. Patches are validated against sandbox policies and applied
  atomically with backups in `.deepseek/backup/`.

### Safe Command Execution

- `deepseek exec "<command>"` — run a shell command inside the sandbox. Options: `--cwd`, `--timeout <ms>`,
  `--yes`, and `--json`. Execution obeys sandbox/approval rules, captures stdout/stderr, and records
  lifecycle events.

### Configuration

Runtime configuration is merged from:

1. `src/config/default.json`
2. `.deepseek/config.json` (created automatically on first change)
3. Environment overrides (`DEEPSEEK_SANDBOX_MODE`, `DEEPSEEK_APPROVALS_POLICY`, `DEEPSEEK_EXEC_TIMEOUT_MS`,
   `DEEPSEEK_EXEC_ENV_WHITELIST`, `DEEPSEEK_WORKSPACE_ROOT`, etc.)

Key sections include API settings, logging level, history directory, sandbox options, approval policy, and
execution defaults (timeout and environment whitelist).

### History & Auditing

All significant operations (session events, sandbox/approval updates, patch previews/apply/rollback, exec
previews/start/finish) are appended as JSON Lines under the configured history directory. This enables
reliable auditing and replay of actions.

## Development Scripts

- `pnpm lint` — lint source files.
- `pnpm lint:fix` — lint with auto fixes.
- `pnpm format` — format the codebase with Prettier.
- `pnpm test` — run the Jest test suite.
- `pnpm build` — compile TypeScript sources to `dist/`.

## Project Structure

```
deepseek-cli/
├── src/
│   ├── api/
│   ├── cli/
│   │   └── commands/
│   ├── config/
│   ├── controllers/
│   ├── core/
│   │   ├── approvals/
│   │   ├── exec/
│   │   ├── patch/
│   │   ├── sandbox/
│   │   ├── models/
│   │   └── services/
│   ├── tui/
│   │   └── components/
│   └── utils/
├── tests/
├── package.json
└── tsconfig.json
```

## Testing

Unit tests cover chat controller behaviour, session persistence, and sandbox/approval flows. Run the suite
with:

```bash
pnpm test
```
