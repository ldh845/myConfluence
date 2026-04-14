/* eslint-disable */
const http = require("http");
const WebSocket = require("ws");
const { setupWSConnection } = require("y-websocket/bin/utils");

const host = process.env.HOST || "0.0.0.0";
const port = parseInt(process.env.PORT || "1234", 10);

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("y-websocket running\n");
});

const wss = new WebSocket.Server({ server });

wss.on("connection", (conn, req) => {
  setupWSConnection(conn, req, { gc: true });
});

server.listen(port, host, () => {
  console.log(`[ws-server] listening at ws://${host}:${port}`);
});

process.on("SIGINT", () => {
  console.log("[ws-server] shutting down");
  server.close(() => process.exit(0));
});
