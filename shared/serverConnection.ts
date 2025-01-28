import { encodeMessage, decodeMessage, Message, MessageType, World } from "./messages";
import { BlobStorage } from "./storage";
import { generateWorld } from "./world";
import * as msgpack from "@msgpack/msgpack";

export type User = {
  username: string;
  token: string;
};

export type ServerConnection = {
  send: (data: Message) => Promise<void>;
};

export type LocalServerConnection = ServerConnection & {
  currentWorld: () => World | null;
  currentUser: () => User | null;
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
  let user = null as User | null;
  return {
    send: async (m: Message) => {
      switch (m.type) {
        case MessageType.Register:
          const token = Math.random().toString(36).slice(2);
          users.save(token, msgpack.encode({ username: m.username }));
          sendToClient({ type: MessageType.LoginStatus, username: m.username, token, status: "success" });
          break;
        case MessageType.Login:
          try {
            user = msgpack.decode(await users.load(m.token)) as User;
          } catch (error) {
            sendToClient({ type: MessageType.LoginStatus, username: "", token: "", status: "failure" });
            return;
          }
          sendToClient({ type: MessageType.LoginStatus, username: user.username, token: m.token, status: "success" });
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
            world = msgpack.decode(await worlds.load(m.token)) as World;
            sendToClient({ type: MessageType.WorldData, world });
          } catch (error) {
            sendToClient({ type: MessageType.WorldData, world: null });
          }
          break;
        case MessageType.UpdateVoxel:
          if (world === null) {
            throw new Error("No world loaded");
          }
          world.voxels[m.index] = m.value;
          sendToWorld(world.token, m);
          worlds.save(world.token, msgpack.encode(world));
          break;
        case MessageType.UserMove:
          if (world === null) {
            throw new Error("No world loaded");
          }
          if (world.users[m.username] === undefined) {
            world.users[m.username] = { pos: [0, 0, 0], azimuth: 0, elevation: 0, vel: [0, 0, 0] };
          }
          world.users[m.username].pos = m.pos;
          world.users[m.username].azimuth = m.azimuth;
          world.users[m.username].elevation = m.elevation;
          world.users[m.username].vel = m.vel;
          sendToWorld(world.token, m);
          worlds.save(world.token, msgpack.encode(world));
          break;
        default:
          throw new Error("Not implemented");
      }
    },
    currentWorld: () => world,
    currentUser: () => user,
  }
};
