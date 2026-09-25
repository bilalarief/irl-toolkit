import type { EditorScene, EditorItem } from '../protocol/types';

// Local editor state: original + current (phase 9)
// Do NOT modify OBS directly while dragging; only on Save

export interface SceneDiff {
  sceneItemId: number;
  patch: Partial<EditorItem>;
  deleted?: boolean;
}

export interface EditorStore {
  original: EditorScene | null;
  current: EditorScene | null;
  setScene(scene: EditorScene): void;
  updateItem(id: number, patch: Partial<EditorItem>): void;
  hasChanges(): boolean;
  discard(): void;
  computeDiff(): SceneDiff[];
}

export function createEditorStore(): EditorStore & { subscribe: (cb: () => void) => () => void } {
  let original: EditorScene | null = null;
  let current: EditorScene | null = null;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((cb) => cb());

  return {
    get original() {
      return original;
    },
    get current() {
      return current;
    },
    setScene(scene: EditorScene) {
      original = structuredClone(scene);
      current = structuredClone(scene);
      notify();
    },
    updateItem(id: number, patch: Partial<EditorItem>) {
      if (!current) return;
      const idx = current.items.findIndex((i) => i.sceneItemId === id);
      if (idx === -1) return;
      current.items[idx] = { ...current.items[idx], ...patch };
      notify();
    },
    hasChanges() {
      if (!original || !current) return false;
      return JSON.stringify(original) !== JSON.stringify(current);
    },
    discard() {
      if (original) current = structuredClone(original);
      notify();
    },
    computeDiff() {
      if (!original || !current) return [];
      const diffs: SceneDiff[] = [];
      // Deleted: in original but missing from current
      for (const orig of original.items) {
        if (!current.items.some((i) => i.sceneItemId === orig.sceneItemId)) {
          diffs.push({ sceneItemId: orig.sceneItemId, patch: {}, deleted: true });
        }
      }
      for (const cur of current.items) {
        const orig = original.items.find((o) => o.sceneItemId === cur.sceneItemId);
        if (!orig) continue;
        const patch: Partial<EditorItem> = {};
        let changed = false;
        (Object.keys(cur) as (keyof EditorItem)[]).forEach((k) => {
          if (cur[k] !== orig[k]) {
            (patch as Record<string, unknown>)[k] = cur[k];
            changed = true;
          }
        });
        if (changed) diffs.push({ sceneItemId: cur.sceneItemId, patch });
      }
      return diffs;
    },
    subscribe(cb: () => void) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}
