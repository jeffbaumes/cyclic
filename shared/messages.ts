import { encode, decode } from '@msgpack/msgpack';
import { vec3 } from "gl-matrix";

export type World = {
  token: string;
  voxelData: Uint8Array;
  players: Record<string, {
    position: vec3;
    lookDirection: vec3;
  }>;
};

export enum MessageType {
  Register,
  Login,
  LoginStatus,
  NewWorld,
  JoinWorld,
  WorldData,
  ListWorlds,
  WorldList,
};

export type RegisterMessage = {
  type: MessageType.Register;
  username: string;
};

export type LoginMessage = {
  type: MessageType.Login;
  token: string;
};

export type LoginStatusMessage = {
  type: MessageType.LoginStatus;
  username: string;
  token: string;
  status: 'success' | 'failure';
};

export type NewWorldMessage = {
  type: MessageType.NewWorld;
};

export type JoinWorldMessage = {
  type: MessageType.JoinWorld;
  token: string;
};

export type WorldMessage = {
  type: MessageType.WorldData;
  world: World;
};

export type ListWorldsMessage = {
  type: MessageType.ListWorlds;
};

export type WorldListMessage = {
  type: MessageType.WorldList;
  worlds: string[];
};

export type Message =
  RegisterMessage
  | LoginMessage
  | LoginStatusMessage
  | NewWorldMessage
  | JoinWorldMessage
  | WorldMessage
  | ListWorldsMessage
  | WorldListMessage;

export const encodeMessage = (message: Message): ArrayBuffer => {
  return encode(message);
};

export const decodeMessage = (encoded: ArrayBuffer): Message => {
  return decode(encoded) as Message;
};
