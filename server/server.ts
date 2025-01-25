import { WebSocketServer, WebSocket } from 'ws';
import { generateVoxelData } from './worldGenerator';
import { ConnectMessage, decodeMessage, encodeMessage, MessageType } from '../shared/messages';

const wss = new WebSocketServer({ port: 8080 });

type ClientSession = {
  user: string;
  world: string;
};

const sessions = new Map<WebSocket, ClientSession>();

wss.on('connection', (ws: WebSocket) => {
  ws.on('message', (data) => {
    ws.binaryType = "arraybuffer";
    if (Array.isArray(data) || typeof data === "string") {
      // Not handling these types
      console.error("Unhandled message format");
      return;
    }
    const m = decodeMessage(data);
    if (!sessions.has(ws)) {
      const {user, world} = m as ConnectMessage;
      sessions.set(ws, { user, world });

      const emoji = ['😊', '🌿', '🌳', '🐄', '🪵', '🪨'];
      const emojiIndex = {} as Record<string, number>;
      emoji.map((emoji, index) => emojiIndex[emoji] = index);

      const voxelData = generateVoxelData(64, emojiIndex);
      ws.send(encodeMessage({ type: MessageType.WorldData, data: voxelData }));
    }
  });
});
