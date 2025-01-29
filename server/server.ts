import { WebSocketServer, WebSocket } from 'ws';
import { decodeMessage, encodeMessage } from '../shared/messages';
import { createLocalServerConnection, LocalServerConnection } from '../shared/serverConnection';
import { createFileBlobStorage } from './storage';
import * as https from 'https';
import * as fs from 'fs';

const main = async () => {
  let config: any;
  if (process.env.DOMAIN) {
    const server = https.createServer({
      cert: fs.readFileSync(`/etc/letsencrypt/live/${process.env.DOMAIN}/fullchain.pem`),
      key: fs.readFileSync(`/etc/letsencrypt/live/${process.env.DOMAIN}/privkey.pem`),
    });
    config = { server };
  } else {
    config = { host: '0.0.0.0', port: 8080 };
  }

  const wss = new WebSocketServer(config);

  const users = await createFileBlobStorage("./data/users");
  const worlds = await createFileBlobStorage("./data/worlds");
  const connections = [] as {ws: WebSocket, localConn: LocalServerConnection}[];

  wss.on('connection', async (ws: WebSocket) => {
    const localConn = await createLocalServerConnection(
      (message) => {
        ws.send(encodeMessage(message));
      },
      (world, message) => {
        connections.forEach(({ ws, localConn }) => {
          if (localConn.currentWorld()?.token === world) {
            ws.send(encodeMessage(message));
          }
        });
      },
      worlds,
      users,
    );

    connections.push({ ws, localConn });

    ws.on('message', (data) => {
      ws.binaryType = "arraybuffer";
      if (Array.isArray(data) || typeof data === "string") {
        console.error("Unhandled message format");
        return;
      }
      if (Buffer.isBuffer(data)) {
        data = new Uint8Array(data);
      }
      localConn.send(decodeMessage(data));
    });
  });

  if (config.server) {
    config.server.listen(443);
  }
};

main();
