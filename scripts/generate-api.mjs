// Generates the API types from the backend contract (ADR 0005).
// Usage: pnpm generate:api  (reads contracts/openapi.yaml from FLUXO_BACKEND_DIR, or from ../backend when it is not set,
// and writes packages/react/src/api/generated/schema.ts)
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const backendDir = process.env.FLUXO_BACKEND_DIR
const contract = resolve(backendDir ? resolve(backendDir) : resolve(root, '..', 'backend'), 'contracts', 'openapi.yaml')
const output = resolve(root, 'packages', 'react', 'src', 'api', 'generated', 'schema.ts')

if (!existsSync(contract)) {
  console.error(`generate:api — contrato não encontrado: ${contract}`)
  if (backendDir) {
    console.error(`FLUXO_BACKEND_DIR está definida (${backendDir}), mas a pasta não tem contracts/openapi.yaml.`)
  } else {
    console.error('O repositório do backend precisa estar ao lado deste (../backend) com contracts/openapi.yaml, ou defina FLUXO_BACKEND_DIR.')
  }
  process.exit(1)
}

mkdirSync(dirname(output), { recursive: true })
const bin = resolve(root, 'node_modules', 'openapi-typescript', 'bin', 'cli.js')
const r = spawnSync(process.execPath, [bin, contract, '-o', output], { stdio: 'inherit', cwd: root })
if (r.status !== 0) {
  console.error('generate:api — falha ao gerar os tipos.')
  process.exit(r.status ?? 1)
}
