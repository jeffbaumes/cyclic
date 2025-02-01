import { encode, decode } from '@msgpack/msgpack';

export type World = {
  token: string;
  voxels: Uint8Array;
  users: Record<string, {
    pos: number[];
    azimuth: number;
    elevation: number;
    vel: number[];
  }>;
};

export enum MessageType {
  Register,
  Login,
  LoginStatus,
  NewWorld,
  JoinWorld,
  UserJoined,
  WorldData,
  ListWorlds,
  WorldList,
  LeaveWorld,
  UserLeft,
  LogOut,
  UpdateVoxel,
  UserMove,
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

export type UserJoinedMessage = {
  type: MessageType.UserJoined;
  username: string;
};

export type WorldMessage = {
  type: MessageType.WorldData;
  world: World | null;
};

export type ListWorldsMessage = {
  type: MessageType.ListWorlds;
};

export type WorldListMessage = {
  type: MessageType.WorldList;
  worlds: string[];
};

export type UpdateVoxelMessage = {
  type: MessageType.UpdateVoxel;
  index: number;
  value: number;
};

export type UserMoveMessage = {
  type: MessageType.UserMove;
  username: string;
  pos: number[];
  azimuth: number;
  elevation: number;
  vel: number[];
};

export type LeaveWorldMessage = {
  type: MessageType.LeaveWorld;
};

export type UserLeftMessage = {
  type: MessageType.UserLeft;
  username: string;
};

export type LogOutMessage = {
  type: MessageType.LogOut;
};

export type Message =
  RegisterMessage
  | LoginMessage
  | LoginStatusMessage
  | NewWorldMessage
  | JoinWorldMessage
  | UserJoinedMessage
  | WorldMessage
  | ListWorldsMessage
  | WorldListMessage
  | UpdateVoxelMessage
  | UserMoveMessage
  | LeaveWorldMessage
  | UserLeftMessage
  | LogOutMessage;

export const encodeMessage = (message: Message): ArrayBuffer => {
  return encode(message);
};

export const decodeMessage = (encoded: ArrayBuffer): Message => {
  return decode(encoded) as Message;
};
