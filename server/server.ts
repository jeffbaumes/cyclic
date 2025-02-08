import { WebSocketServer, WebSocket } from 'ws';
import { decodeMessage, encodeMessage } from '../shared/messages';
import { createLocalServerConnection, LocalServerConnection } from '../shared/serverConnection';
import { createFileBlobStorage } from './storage';

const main = async () => {
  const wss = new WebSocketServer({ port: 8080 });

  const users = await createFileBlobStorage("./data/users");
  const worlds = await createFileBlobStorage("./data/worlds");
  const connections = [] as { ws: WebSocket, localConn: LocalServerConnection }[];

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
};

main();
