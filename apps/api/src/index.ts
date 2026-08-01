import { Hono } from "hono"
import { cors } from "hono/cors"
import forgesRoute from "./routes/forges"
import interviewsRoute from "./routes/interviews"
import toolsRoute from "./routes/tools"
import voiceRoute from "./routes/voice"
import documentsRoute from "./routes/documents"
import workspacesRoute from "./routes/workspaces"
import learnRoute from "./routes/learn"

const app = new Hono()

app.use("/*", cors({
  origin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",")
    : ["http://localhost:3070", "http://localhost:5173"],
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type"],
}))

app.route("/api/workspaces", workspacesRoute)
app.route("/api/learn", learnRoute)
app.route("/api/workspaces", toolsRoute)
app.route("/api/workspaces", documentsRoute)
app.route("/api/forges", forgesRoute)
app.route("/api/forges", interviewsRoute)
app.route("/api/forges", voiceRoute)

app.get("/api/health", (c) => c.json({ status: "ok" }))

const port = Number(process.env.PORT) || 3071

console.log(`Forge API running on http://localhost:${port}`)

export default {
  port,
  fetch: app.fetch,
  idleTimeout: 120,
}
