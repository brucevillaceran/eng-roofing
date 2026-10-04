import express from "express";
import { createServer as createViteServer } from "vite";
import { createStore } from "./store.js";
import { createApi } from "./api.js";
const app = createApi(
  createStore(process.env.ENG_DATABASE || "data/eng-roofing.sqlite"),
);
if (process.env.NODE_ENV === "production") {
  app.use(express.static("dist"));
  app.get("/{*path}", (_, res) =>
    res.sendFile(`${process.cwd()}/dist/index.html`),
  );
} else {
  const vite = await createViteServer({
    server: {
      middlewareMode: true,
      allowedHosts: true,
      fs: {
        strict: true,
        allow: [process.cwd()],
        deny: [
          "**/.env*",
          "**/.git/**",
          "**/server/**",
          "**/*.{sqlite,sqlite-wal,sqlite-shm,db}",
        ],
      },
    },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
app.listen(Number(process.env.PORT || 3000), "0.0.0.0", () =>
  console.log("ENG Roofing ready"),
);
