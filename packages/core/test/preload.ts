import path from "path"

process.env.LOONGCODE_DB = ":memory:"
process.env.NPM_CONFIG_AUDIT = "false"
process.env.LOONGCODE_MODELS_PATH = path.join(import.meta.dir, "plugin", "fixtures", "models-dev.json")
process.env.LOONGCODE_DISABLE_MODELS_FETCH = "true"
