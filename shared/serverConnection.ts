import { encodeMessage, decodeMessage, Message, MessageType, World } from "./messages";
import { BlobStorage } from "./storage";
import { generateWorld } from "./world";
import * as msgpack from "@msgpack/msgpack";

export type ServerConnection = {
  send: (data: Message) => Promise<void>;
};

export type LocalServerConnection = ServerConnection & {
  currentWorld: () => World | null;
};

export const createWebSocketServerConnection = async (url: string, sendToClient: (data: Message) => void) => {
  return new Promise<ServerConnection>(async (resolve, reject) => {
    try {
      const ws = new WebSocket(url);
      ws.binaryType = "arraybuffer";
      ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          const data = new Uint8Array(event.data);
          sendToClient(decodeMessage(data));
        }
      };

      ws.onerror = (error) => {
        reject(error);
      };

      await new Promise((resolve, reject) => {
        if (ws.readyState === WebSocket.OPEN) {
          resolve(null);
        } else if (ws.readyState === WebSocket.CONNECTING) {
          ws.onopen = resolve;
          ws.onerror = reject;
        } else {
          reject(new Error("WebSocket is closed"));
        }
      });

      resolve({
        send: async (data: Message) => {
          ws.send(encodeMessage(data));
        },
      });
    } catch (error) {
      reject(error);
    }
  });
};

export const createLocalServerConnection = (sendToClient: (data: Message) => void, sendToWorld: (world: string, data: Message) => void, worlds: BlobStorage, users: BlobStorage) => {
  let world = null as World | null;
  return {
    send: async (data: Message) => {
      switch (data.type) {
        case MessageType.Register:
          break;
        case MessageType.Login:
          break;
        case MessageType.ListWorlds:
          sendToClient({ type: MessageType.WorldList, worlds: await worlds.list() });
          break;
        case MessageType.NewWorld:
          world = await generateWorld(64);
          worlds.save(world.token, msgpack.encode(world));
          sendToClient({ type: MessageType.WorldData, world });
          break;
        case MessageType.JoinWorld:
          if (world !== null) {
            worlds.save(world.token, msgpack.encode(world));
          }
          try {
            world = msgpack.decode(await worlds.load(data.token)) as World;
            sendToClient({ type: MessageType.WorldData, world });
          } catch (error) {
            sendToClient({ type: MessageType.WorldData, world: null });
          }
          break;
        case MessageType.UpdateVoxel:
          if (world === null) {
            throw new Error("No world loaded");
          }
          world.voxelData[data.index] = data.value;
          sendToWorld(world.token, data);
          worlds.save(world.token, msgpack.encode(world));
          break;
        default:
          throw new Error("Not implemented");
      }
    },
    currentWorld: () => world,
  }
};
