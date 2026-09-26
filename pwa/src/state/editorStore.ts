import type { EditorScene, EditorItem } from '../protocol/types';

// Local editor state: original + current (phase 9)
// Do NOT modify OBS directly while dragging; only on Save

export interface SceneDiff {
  sceneItemId: number;
  patch: Partial<EditorItem>;
  deleted?: boolean;
  added?: boolean;
}

export interface EditorStore {
  original: EditorScene | null;
  current: EditorScene | null;
  setScene(scene: EditorScene): void;
  updateItem(id: number, patch: Partial<EditorItem>): void;
  revertItem(id: number): void;
  reorderItems(idsBottomFirst: number[]): void;
  hasChanges(): boolean;
  discard(): void;
  computeDiff(): SceneDiff[];
  computeOrderTopFirst(): number[] | null;
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
    revertItem(id: number) {
      if (!original || !current) return;
      const orig = original.items.find((o) => o.sceneItemId === id);
      if (!orig) {
        // Never saved (locally added) — reverting removes it
        current.items = current.items.filter((i) => i.sceneItemId !== id);
      } else {
        const idx = current.items.findIndex((i) => i.sceneItemId === id);
        if (idx === -1) return;
        current.items[idx] = structuredClone(orig);
      }
      notify();
    },
    reorderItems(idsBottomFirst: number[]) {
      if (!current) return;
      const byId = new Map(current.items.map((i) => [i.sceneItemId, i]));
      const next: EditorItem[] = [];
      for (const id of idsBottomFirst) {
        const it = byId.get(id);
        if (it) {
          next.push(it);
          byId.delete(id);
        }
      }
      // Keep any stragglers (shouldn't happen) at the end
      for (const it of current.items) {
        if (byId.has(it.sceneItemId)) next.push(it);
      }
      current.items = next;
      notify();
    },
    computeOrderTopFirst() {
      if (!original || !current) return null;
      const a = original.items.map((i) => i.sceneItemId);
      const b = current.items.map((i) => i.sceneItemId);
      if (JSON.stringify(a) === JSON.stringify(b)) return null;
      // Store keeps OBS enum order (bottom-first); plugin expects top-first
      return [...b].reverse();
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
        if (!orig) {
          // New overlay created in the PWA (temp negative id) — send it whole
          const { sceneItemId, ...rest } = cur;
          diffs.push({ sceneItemId, patch: rest, added: true });
          continue;
        }
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
