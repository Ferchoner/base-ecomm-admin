// Servidor estático mínimo para E2E: sirve .output/public con fallback SPA a 200.html.
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'

const root = join(process.cwd(), '.output/public')
const port = Number(process.env.PORT ?? 4173)
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
}

createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)).replace(
    /^(\.\.[/\\])+/,
    '',
  )
  let file = join(root, path)
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html')
  if (!existsSync(file)) file = join(root, '200.html')
  res.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream')
  createReadStream(file).pipe(res)
}).listen(port, () => console.log(`E2E server on http://localhost:${port}`))
