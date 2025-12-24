import {
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  readlink,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, isAbsolute, join, resolve } from 'node:path'
import readline from 'node:readline/promises'

const SOURCE_ROOT = process.cwd()
const DEFAULT_BASE = resolve(SOURCE_ROOT, '..')

function normalizeScopeName(value: string) {
  return value
    .replace(/^@/, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
}

function resolveTargetPath(input: string, repoName: string) {
  const trimmed = input.trim()
  if (!trimmed) {
    return resolve(DEFAULT_BASE, repoName)
  }

  const expanded = trimmed.startsWith('~') ? join(homedir(), trimmed.slice(1)) : trimmed
  const looksLikePath =
    isAbsolute(expanded) ||
    expanded.startsWith('.') ||
    expanded.includes('/') ||
    expanded.includes('\\')

  if (looksLikePath) {
    return resolve(expanded)
  }

  return resolve(DEFAULT_BASE, expanded)
}

async function pathExists(path: string) {
  try {
    await lstat(path)
    return true
  } catch {
    return false
  }
}

async function isDirectoryEmpty(path: string) {
  const entries = await readdir(path)
  return entries.length === 0
}

async function copyDir(source: string, destination: string) {
  await mkdir(destination, { recursive: true })
  const entries = await readdir(source, { withFileTypes: true })

  for (const entry of entries) {
    if (entry.name === 'node_modules') {
      continue
    }

    const sourcePath = join(source, entry.name)
    const destPath = join(destination, entry.name)

    if (entry.isDirectory()) {
      await copyDir(sourcePath, destPath)
      continue
    }

    if (entry.isSymbolicLink()) {
      const link = await readlink(sourcePath)
      await symlink(link, destPath)
      continue
    }

    await copyFile(sourcePath, destPath)
  }
}

async function replaceScope(dir: string, fromScope: string, toScope: string) {
  const entries = await readdir(dir, { withFileTypes: true })

  for (const entry of entries) {
    if (entry.name === 'node_modules') {
      continue
    }

    const entryPath = join(dir, entry.name)

    if (entry.isDirectory()) {
      await replaceScope(entryPath, fromScope, toScope)
      continue
    }

    try {
      const contents = await readFile(entryPath, 'utf8')
      if (!contents.includes(fromScope)) {
        continue
      }
      await writeFile(entryPath, contents.replaceAll(fromScope, toScope))
    } catch {}
  }
}

async function updateRootPackageName(targetRoot: string, newName: string) {
  const packagePath = join(targetRoot, 'package.json')
  try {
    const raw = await readFile(packagePath, 'utf8')
    const data = JSON.parse(raw) as { name?: string }
    data.name = `@${newName}`
    await writeFile(packagePath, `${JSON.stringify(data, null, 2)}\n`)
  } catch {
    console.warn('Warning: failed to update root package.json name.')
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

const input = await rl.question('Enter new repo name/location (default: ../): ')
let repoName = basename(input.trim())

if (!input.trim()) {
  repoName = await rl.question('Enter repo name: ')
}

const normalizedName = normalizeScopeName(repoName)
if (!normalizedName) {
  console.error('Invalid repo name.')
  rl.close()
  process.exit(1)
}

const targetPath = resolveTargetPath(input, normalizedName)
const confirm = await rl.question(
  `Repo location: ${targetPath}\nMonorepo package name: @${normalizedName}\n\nConfirm setup details to continue? (y/n): `,
)
rl.close()

if (!confirm.trim().toLowerCase().startsWith('y')) {
  console.log('Cancelled.')
  process.exit(0)
}

if (await pathExists(targetPath)) {
  const empty = await isDirectoryEmpty(targetPath)
  if (!empty) {
    console.error(`Target directory is not empty: ${targetPath}`)
    process.exit(1)
  }
} else {
  await mkdir(targetPath, { recursive: true })
}

await copyDir(SOURCE_ROOT, targetPath)
await replaceScope(targetPath, '@sokoban-eval-toolkit', `@${normalizedName}`)
await updateRootPackageName(targetPath, normalizedName)

console.log(`Bootstrap complete at ${targetPath}`)
