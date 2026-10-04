import express from "express";
import { createServer as createViteServer } from "vite";
import { createStore } from "./store.js";
import { createApi } from "./api.js";
if (process.argv.includes("--production")) process.env.NODE_ENV = "production";
let store;
try {
  store = await createStore();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
const app = createApi(store);
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
          "**/scripts/**",
          "**/data/**",
          "**/*.{sqlite,sqlite-wal,sqlite-shm,db}",
        ],
      },
    },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
const server = app.listen(Number(process.env.PORT || 3000), "0.0.0.0", () =>
  console.log("ENG Roofing ready"),
);

for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => {
    server.close(async () => {
      await store.close();
      process.exit(0);
    });
  });
