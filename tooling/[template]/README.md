# Tooling Template

Template for creating new tooling/CLI utilities in the monorepo.

## Usage

1. Copy this folder to create a new tool
2. Update `package.json` with the new tool name
3. Update the start script in `package.json` if needed
4. Add your source files in `src/`
5. Implement your CLI/tooling logic in `src/index.ts`

## Structure

- `src/` - Source files
- `package.json` - Package configuration with scripts
- `tsconfig.json` - TypeScript configuration for Node/Bun

## Running

```bash
bun run start
```
