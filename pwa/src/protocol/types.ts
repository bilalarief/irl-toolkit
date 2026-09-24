// Transport-independent protocol (matches plugin/src/protocol/irl-protocol)

export type MessageType = 'ping' | 'pong' | 'get_scene' | 'scene_state' | 'error';

export interface PingMessage {
  type: 'ping';
  requestId?: string;
}
export interface PongMessage {
  type: 'pong';
  requestId?: string;
}
export interface GetSceneMessage {
  type: 'get_scene';
  requestId?: string;
}
export interface EditorItem {
  sceneItemId: number;
  sourceName: string;
  sourceType: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  visible: boolean;
}
export interface EditorScene {
  name: string;
  canvasWidth: number;
  canvasHeight: number;
  items: EditorItem[];
}
export interface SceneStateMessage {
  type: 'scene_state';
  scene: EditorScene;
  requestId?: string;
}
export interface ErrorMessage {
  type: 'error';
  message: string;
  requestId?: string;
}
export type IncomingMessage = PongMessage | SceneStateMessage | ErrorMessage;
export type OutgoingMessage = PingMessage | GetSceneMessage;
