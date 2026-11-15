// Gera os tipos da API a partir do contrato do backend (ADR 0005).
// Uso: pnpm gerar:api  (lê ../backend/contratos/openapi.yaml e escreve packages/react/src/api/gerado/esquema.ts)
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const contrato = resolve(raiz, '..', 'backend', 'contratos', 'openapi.yaml')
const saida = resolve(raiz, 'packages', 'react', 'src', 'api', 'gerado', 'esquema.ts')

if (!existsSync(contrato)) {
  console.error(`gerar:api — contrato não encontrado: ${contrato}`)
  console.error('O repositório do backend precisa estar ao lado deste (../backend) com contratos/openapi.yaml.')
  process.exit(1)
}

mkdirSync(dirname(saida), { recursive: true })
const bin = resolve(raiz, 'node_modules', 'openapi-typescript', 'bin', 'cli.js')
const r = spawnSync(process.execPath, [bin, contrato, '-o', saida], { stdio: 'inherit', cwd: raiz })
if (r.status !== 0) {
  console.error('gerar:api — falha ao gerar os tipos.')
  process.exit(r.status ?? 1)
}
