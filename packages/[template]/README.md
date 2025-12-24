# Package Template

Template for creating new packages in the monorepo.

## Usage

1. Copy this folder to create a new package
2. Update `package.json` with the new package name
3. Update exports in `package.json` as needed
4. Add your source files in `src/`
5. Export your public API from `src/index.ts` or configure custom exports

## Structure

- `src/` - Source files
- `package.json` - Package configuration with exports
- `tsconfig.json` - TypeScript configuration
