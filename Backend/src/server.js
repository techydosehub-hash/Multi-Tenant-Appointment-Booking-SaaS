import app from "./app.js";
import { env } from "./config.js";
const server = app.listen(env.PORT, "0.0.0.0", () =>
  console.log(JSON.stringify({ event: "server_started", port: env.PORT })),
);
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.once(signal, () => {
    console.log(JSON.stringify({ event: "server_stopping", signal }));
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  });
}
