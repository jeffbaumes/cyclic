import { encode, decode } from '@msgpack/msgpack';

export enum MessageType {
  Connect = 1,
  WorldData = 2,
};

export type WorldMessage = {
  type: MessageType.WorldData;
  data: Uint8Array;
};

export type ConnectMessage = {
  type: MessageType.Connect;
  user: string;
  world: string;
};

export type Message = ConnectMessage | WorldMessage;

export const encodeMessage = (message: Message): ArrayBuffer => {
  return encode(message);
};

export const decodeMessage = (encoded: ArrayBuffer): Message => {
  return decode(encoded) as Message;
};
