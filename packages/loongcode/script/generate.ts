import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dir = path.resolve(__dirname, "..")

process.chdir(dir)

// Vendored models.dev snapshot at the repo root; refresh it by hand.
export const modelsData = await Bun.file(path.resolve(dir, "../../api.json")).text()
console.log("Loaded models.dev snapshot from api.json")
