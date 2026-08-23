const express = require("express");
const helmet = require("helmet");
const adminRoutes = require("./routes/admin.routes");
const internalRoutes = require("./routes/internal.routes");
const { notFound, errorHandler } = require("./middleware/error.middleware");

const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(express.json({ limit: "10mb" }));

app.get("/health", (_req, res) => {
  res.json({
    success: true,
    service: "ai-service",
    status: "ok"
  });
});

app.use("/api/v1/ai/admin", adminRoutes);
app.use("/api/v1/ai/internal", internalRoutes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
