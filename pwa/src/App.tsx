import { useEffect, useState } from 'react';
import { useWebSocket } from './connection/useWebSocket';
import { PairingScreen } from './connection/PairingScreen';
import { Canvas } from './editor/Canvas';
import { Drawers, type DrawerType } from './editor/Drawers';
import type { EditorScene, EditorItem } from './protocol/types';
import { createEditorStore } from './state/editorStore';

const store = createEditorStore();

export default function App() {
  const { status, lastMessage, send, connect, disconnect, url, setUrl } = useWebSocket();
  const [, setSceneTick] = useState(0);
  const [, force] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [drawer, setDrawer] = useState<DrawerType>('none');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [thumbs, setThumbs] = useState<Record<number, string>>({});

  // Subscribe to editor store changes
  useEffect(() => store.subscribe(() => force((x) => x + 1)), []);

  // Handle incoming WebSocket messages.
  // Per-source thumbnails: requested on connect, after save, and via
  // Update Scene. No polling. Plugin screenshots each source, stores it in
  // its local thumbs folder, (dummy-)uploads it, and returns image data.
  useEffect(() => {
    if (!lastMessage) return;
    if (lastMessage.type === 'scene_state') {
      store.setScene(lastMessage.scene);
      setSceneTick((v) => v + 1);
      send({ type: 'get_thumbnails', requestId: `thumbs-${Date.now()}` } as const);
    } else if (lastMessage.type === 'save_result') {
      if (lastMessage.success) {
        if (lastMessage.scene) {
          store.setScene(lastMessage.scene);
          setSceneTick((v) => v + 1);
        } else if (store.current) {
          store.setScene(store.current);
        }
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
        send({ type: 'get_thumbnails', requestId: `thumbs-${Date.now()}` } as const);
      } else {
        setSaveStatus('error');
        alert(`Save failed: ${lastMessage.error ?? 'unknown'}`);
      }
    } else if (lastMessage.type === 'thumbnails') {
      const map: Record<number, string> = {};
      for (const it of lastMessage.items) {
        if (it.thumbnail) map[it.sceneItemId] = it.thumbnail;
      }
      setThumbs(map);
    }
  }, [lastMessage, send]);

  const scene: EditorScene | null = store.current;
  const selectedItem: EditorItem | null = scene?.items.find((i) => i.sceneItemId === selectedId) ?? null;
  const hasChanges = store.hasChanges();

  const handleMove = (id: number, x: number, y: number) => {
    store.updateItem(id, { x, y });
    force((v) => v + 1);
  };

  const handleDelete = (id: number) => {
    if (!store.current) return;
    store.current.items = store.current.items.filter((i) => i.sceneItemId !== id);
    if (selectedId === id) setSelectedId(null);
    force((v) => v + 1);
  };

  const handleToggleVisible = (id: number, visible: boolean) => {
    store.updateItem(id, { visible });
    force((v) => v + 1);
  };

  const handleUpdateItem = (id: number, patch: Partial<EditorItem>) => {
    store.updateItem(id, patch);
    force((v) => v + 1);
  };

  const handleAddItem = (name: string, width: number, height: number) => {
    if (!store.current) return;
    const newId = Math.max(0, ...store.current.items.map((i) => i.sceneItemId)) + 1;
    const newItem: EditorItem = {
      sceneItemId: newId,
      sourceName: name,
      sourceType: 'browser_source',
      x: 100,
      y: 100,
      width,
      height,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      visible: true,
    };
    store.current.items.push(newItem);
    setSelectedId(newId);
    force((v) => v + 1);
  };

  const handleResetRotation = (id: number) => {
    store.updateItem(id, { rotation: 0 });
    force((v) => v + 1);
  };

  const handleSave = () => {
    const diff = store.computeDiff();
    if (diff.length === 0) return;
    const changes = diff.map((d) => ({ sceneItemId: d.sceneItemId, ...d.patch }));
    const ok = send({ type: 'save_changes', changes, requestId: `save-${Date.now()}` } as const);
    if (!ok) {
      alert('Not connected to OBS plugin');
      return;
    }
    setSaveStatus('saving');
  };

  const handleRefresh = () => {
    send({ type: 'get_scene', requestId: `r-${Date.now()}` });
    send({ type: 'get_thumbnails', requestId: `thumbs-${Date.now()}` } as const);
  };

  const handleConnectUrl = (newUrl: string) => {
    setUrl(newUrl);
    disconnect();
    setTimeout(connect, 100);
  };

  const handleDisconnect = () => {
    disconnect();
    setDrawer('none');
    setSelectedId(null);
  };

  // If disconnected or connecting, display the full portrait pairing screen
  if (status !== 'connected') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', minHeight: '100vh', backgroundColor: '#0b0b0c' }}>
        <PairingScreen onConnect={handleConnectUrl} status={status} currentUrl={url} />
      </div>
    );
  }

  // When connected, display the Visual Canvas Editor (Landscape Figma UI)
  return (
    <div
      style={{
        margin: 0,
        padding: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: '#0a0a0c',
        fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
        color: '#fff',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      {/* 844px x 390px Viewport Frame */}
      <div
        style={{
          width: 'min(844px, 100vw)',
          height: 'min(390px, 100vh)',
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: '#111',
          boxShadow: '0 0 60px rgba(0,0,0,0.95)',
        }}
      >
        {/* Ambient Room backdrop */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 1, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 40%, #2f343b 0%, #1c1e24 45%, #101115 85%, #08090b 100%)' }} />
          <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 90px rgba(0,0,0,0.85)', pointerEvents: 'none' }} />
        </div>

        {/* Interactive Canvas — labeled boxes positioned from OBS scene data */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 10 }}>
          <Canvas
            scene={scene}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onMove={handleMove}
            onEdit={(id) => {
              setSelectedId(id);
              setDrawer('edit_overlay');
            }}
            onDelete={handleDelete}
            onResetRotation={handleResetRotation}
            thumbs={thumbs}
          />
        </div>

        {/* Top-Right Menu Button */}
        <div style={{ position: 'absolute', top: 12, right: 14, zIndex: 25 }}>
          <button
            type="button"
            title="Open Menu"
            onClick={() => setDrawer(drawer === 'none' ? 'menu' : 'none')}
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              width: 40,
              height: 40,
              background: 'rgba(30, 30, 35, 0.85)',
              backdropFilter: 'blur(8px)',
              border: '1.5px solid rgba(255,255,255,0.2)',
              borderRadius: 10,
              boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
              cursor: 'pointer',
              color: '#fff',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.5 2.5H2.50004C1.58337 2.5 0.833374 3.25 0.833374 4.16667V15.8333C0.833374 16.75 1.58337 17.5 2.50004 17.5H17.5C18.4167 17.5 19.1667 16.75 19.1667 15.8333V4.16667C19.1667 3.25 18.4167 2.5 17.5 2.5ZM17.5 15.8333H2.50004V4.16667H17.5V15.8333ZM9.16671 10H16.6667V15H9.16671V10Z" fill="white" />
            </svg>
          </button>
        </div>

        {/* Bottom Unsaved Changes & Save Badge */}
        {hasChanges && (
          <div style={{ position: 'absolute', bottom: 14, left: 14, zIndex: 25, display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={handleSave}
              style={{
                backgroundColor: '#fac800',
                color: '#111',
                border: 'none',
                borderRadius: 8,
                padding: '6px 14px',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                boxShadow: '0 2px 10px rgba(250, 200, 0, 0.4)',
              }}
            >
              {saveStatus === 'saving' ? 'Menyimpan...' : saveStatus === 'saved' ? 'Tersimpan!' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={() => {
                store.discard();
                setSelectedId(null);
              }}
              style={{
                backgroundColor: 'rgba(255,255,255,0.12)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 8,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Discard
            </button>
          </div>
        )}

        {/* Drawers (Menu, OBS Settings, Scene Changer, Overlays List, Edit Overlay, Add Overlay) */}
        <Drawers
          drawer={drawer}
          setDrawer={setDrawer}
          scene={scene}
          selectedItem={selectedItem}
          onSelectItem={setSelectedId}
          onUpdateScene={handleRefresh}
          onDisconnect={handleDisconnect}
          onSave={handleSave}
          onDelete={handleDelete}
          onToggleVisible={handleToggleVisible}
          onUpdateItem={handleUpdateItem}
          onAddItem={handleAddItem}
        />
      </div>
    </div>
  );
}
