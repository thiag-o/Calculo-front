// Generates the API types from the backend contract (ADR 0005).
// Usage: pnpm generate:api  (reads ../backend/contracts/openapi.yaml and writes packages/react/src/api/generated/schema.ts)
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const contract = resolve(root, '..', 'backend', 'contracts', 'openapi.yaml')
const output = resolve(root, 'packages', 'react', 'src', 'api', 'generated', 'schema.ts')

if (!existsSync(contract)) {
  console.error(`generate:api — contrato não encontrado: ${contract}`)
  console.error('O repositório do backend precisa estar ao lado deste (../backend) com contracts/openapi.yaml.')
  process.exit(1)
}

mkdirSync(dirname(output), { recursive: true })
const bin = resolve(root, 'node_modules', 'openapi-typescript', 'bin', 'cli.js')
const r = spawnSync(process.execPath, [bin, contract, '-o', output], { stdio: 'inherit', cwd: root })
if (r.status !== 0) {
  console.error('generate:api — falha ao gerar os tipos.')
  process.exit(r.status ?? 1)
}
