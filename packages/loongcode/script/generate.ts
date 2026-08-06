import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dir = path.resolve(__dirname, "..")

process.chdir(dir)

const modelsUrl = process.env.LOONGCODE_MODELS_URL || "https://models.dev"

const fixture = path.join(dir, "test", "tool", "fixtures", "models-api.json")

export const modelsData = process.env.MODELS_DEV_API_JSON
  ? await Bun.file(process.env.MODELS_DEV_API_JSON).text()
  : await fetch(`${modelsUrl}/api.json`)
      .then((x) => x.text())
      .catch(async (err) => {
        console.warn(`Failed to fetch models.dev (${err.message}), falling back to local fixture`)
        return Bun.file(fixture).text()
      })
console.log("Loaded models.dev snapshot")
