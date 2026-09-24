// Transport-independent protocol (matches plugin/src/protocol/irl-protocol)

export type MessageType = 'ping' | 'pong' | 'get_scene' | 'scene_state' | 'save_changes' | 'save_result' | 'get_thumbnail' | 'thumbnail' | 'get_thumbnails' | 'thumbnails' | 'error';

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
export interface SaveChangesMessage {
  type: 'save_changes';
  changes: Array<{ sceneItemId: number } & Partial<EditorItem>>;
  requestId?: string;
}
export interface SaveResultMessage {
  type: 'save_result';
  success: boolean;
  error?: string;
  scene?: EditorScene;
  requestId?: string;
}
export interface GetThumbnailMessage {
  type: 'get_thumbnail';
  requestId?: string;
}
export interface ThumbnailMessage {
  type: 'thumbnail';
  data: string; // data:image/jpeg;base64,...
  error?: string;
  requestId?: string;
}
export interface GetThumbnailsMessage {
  type: 'get_thumbnails';
  requestId?: string;
}
export interface ThumbnailsMessage {
  type: 'thumbnails';
  items: Array<{ sceneItemId: number; thumbnail: string }>;
  requestId?: string;
}
export interface ErrorMessage {
  type: 'error';
  message: string;
  requestId?: string;
}
export type IncomingMessage = PongMessage | SceneStateMessage | SaveResultMessage | ThumbnailMessage | ThumbnailsMessage | ErrorMessage;
export type OutgoingMessage = PingMessage | GetSceneMessage | SaveChangesMessage | GetThumbnailMessage | GetThumbnailsMessage;
