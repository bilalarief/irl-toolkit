import { useEffect, useState } from 'react';
import { useWebSocket } from './connection/useWebSocket';
import { PairingScreen } from './connection/PairingScreen';
import { Canvas } from './editor/Canvas';
import { Drawers, type DrawerType } from './editor/Drawers';
import type { EditorScene, EditorItem, SaveChangesMessage, PairCredential } from './protocol/types';
import { createEditorStore } from './state/editorStore';

const store = createEditorStore();

export default function App() {
  const { status, pairError, lastMessage, send, connectWith, disconnect, url, setUrl } = useWebSocket();
  const [, setSceneTick] = useState(0);
  const [, force] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [drawer, setDrawer] = useState<DrawerType>('none');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [scenes, setScenes] = useState<string[]>([]);
  const [streaming, setStreaming] = useState<boolean | null>(null);
  const [streamSettings, setStreamSettings] = useState<{ serviceId: string; service: string; server: string; key: string } | null>(null);

  // Subscribe to editor store changes
  useEffect(() => store.subscribe(() => force((x) => x + 1)), []);

  // Handle incoming WebSocket messages.
  // Thumbnails removed for now — canvas shows labeled border boxes positioned
  // from real OBS scene data.
  useEffect(() => {
    if (!lastMessage) return;
    if (lastMessage.type === 'scene_state') {
      store.setScene(lastMessage.scene);
      setSceneTick((v) => v + 1);
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
      } else {
        setSaveStatus('error');
        alert(`Save failed: ${lastMessage.error ?? 'unknown'}`);
      }
    } else if (lastMessage.type === 'scene_list') {
      setScenes(lastMessage.scenes);
    } else if (lastMessage.type === 'stream_status') {
      setStreaming(lastMessage.streaming);
    } else if (lastMessage.type === 'stream_settings') {
      setStreamSettings({
        serviceId: lastMessage.serviceId,
        service: lastMessage.service,
        server: lastMessage.server,
        key: lastMessage.key,
      });
    } else if (lastMessage.type === 'error') {
      if (lastMessage.requestId?.startsWith('switch-')) {
        alert(`Scene switch failed: ${lastMessage.message}`);
      }
    }
  }, [lastMessage]);

  const scene: EditorScene | null = store.current;
  const selectedItem: EditorItem | null = scene?.items.find((i) => i.sceneItemId === selectedId) ?? null;
  const hasChanges = store.hasChanges();

  const handleMove = (id: number, x: number, y: number) => {
    store.updateItem(id, { x, y });
    force((v) => v + 1);
  };

  const handleResize = (id: number, patch: { x?: number; y?: number; scaleX?: number; scaleY?: number }) => {
    store.updateItem(id, patch);
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

  const handleAddItem = (name: string, url: string, width: number, height: number, visible: boolean) => {
    if (!store.current) return;
    // Temp negative id: marks the item as not-yet-in-OBS until save
    const minId = Math.min(0, ...store.current.items.map((i) => i.sceneItemId));
    const tempId = minId - 1;
    const cw = store.current.canvasWidth || 1920;
    const ch = store.current.canvasHeight || 1080;
    const newItem: EditorItem = {
      sceneItemId: tempId,
      sourceName: name.trim() || 'Browser',
      sourceType: 'browser_source',
      url: url.trim(),
      x: Math.max(0, (cw - width) / 2),
      y: Math.max(0, (ch - height) / 2),
      width,
      height,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      visible,
    };
    store.current.items.push(newItem);
    setSelectedId(tempId);
    force((v) => v + 1);
  };

  const handleReorder = (idsTopFirst: number[]) => {
    store.reorderItems([...idsTopFirst].reverse());
    force((v) => v + 1);
  };

  const handleRevertItem = (id: number) => {
    store.revertItem(id);
    force((v) => v + 1);
  };

  const handleSave = () => {
    const diff = store.computeDiff();
    const order = store.computeOrderTopFirst();
    if (diff.length === 0 && !order) return;
    const changes = diff.map((d) =>
      d.deleted
        ? { sceneItemId: d.sceneItemId, deleted: true }
        : d.added
          ? { sceneItemId: d.sceneItemId, added: true, ...d.patch }
          : { sceneItemId: d.sceneItemId, ...d.patch }
    );
    const payload: SaveChangesMessage = {
      type: 'save_changes',
      changes,
      requestId: `save-${Date.now()}`,
    };
    if (order) payload.order = order;
    const ok = send(payload);
    if (!ok) {
      alert('Not connected to OBS plugin');
      return;
    }
    setSaveStatus('saving');
  };

  const handleRefresh = () => {
    send({ type: 'get_scene', requestId: `r-${Date.now()}` });
    send({ type: 'get_scenes', requestId: `scenes-${Date.now()}` });
  };

  // Keep the streaming badge fresh while connected
  useEffect(() => {
    if (status !== 'connected') {
      setStreaming(null);
      return;
    }
    send({ type: 'get_stream_status', requestId: `stream-${Date.now()}` });
  }, [status, send]);

  const handleStartStream = () => {
    send({ type: 'start_stream', requestId: `stream-${Date.now()}` });
  };

  const handleStopStream = () => {
    send({ type: 'stop_stream', requestId: `stream-${Date.now()}` });
  };

  const handleSwitchScene = (name: string) => {
    if (name === scene?.name) return;
    send({ type: 'switch_scene', name, requestId: `switch-${Date.now()}` });
    // Refresh the list as well so current highlight follows
    send({ type: 'get_scenes', requestId: `scenes-${Date.now()}` });
  };

  const handleOpenDrawer = (d: DrawerType) => {
    if (d === 'scene_changer') {
      send({ type: 'get_scenes', requestId: `scenes-${Date.now()}` });
    }
    if (d === 'obs_settings') {
      send({ type: 'get_stream_status', requestId: `stream-${Date.now()}` });
      send({ type: 'get_stream_settings', requestId: `svc-${Date.now()}` });
    }
    setDrawer(d);
  };

  const handleConnectUrl = (newUrl: string, cred?: PairCredential) => {
    setUrl(newUrl);
    disconnect();
    connectWith(newUrl, cred);
  };

  const handleDisconnect = () => {
    disconnect();
    setDrawer('none');
    setSelectedId(null);
  };

  // If not connected, display the full portrait pairing screen
  if (status !== 'connected') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', minHeight: '100vh', backgroundColor: '#0b0b0c' }}>
        <PairingScreen onConnect={handleConnectUrl} status={status} pairError={pairError} currentUrl={url} />
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
            onResize={handleResize}
            onEdit={(id) => {
              setSelectedId(id);
              setDrawer('edit_overlay');
            }}
            onDelete={handleDelete}
          />
        </div>

        {/* Top-Right Menu Button */}
        <div style={{ position: 'absolute', top: 12, right: 14, zIndex: 25 }}>
          <button
            type="button"
            title="Open Menu"
            onClick={() => handleOpenDrawer(drawer === 'none' ? 'menu' : 'none')}
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

        {/* Quick Update Scene Button (below menu) */}
        <div style={{ position: 'absolute', top: 60, right: 14, zIndex: 25 }}>
          <button
            type="button"
            title="Update Scene"
            onClick={handleRefresh}
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
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
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
          setDrawer={handleOpenDrawer}
          scene={scene}
          scenes={scenes}
          selectedItem={selectedItem}
          onSelectItem={setSelectedId}
          onUpdateScene={handleRefresh}
          onDisconnect={handleDisconnect}
          onSave={handleSave}
          onDelete={handleDelete}
          onToggleVisible={handleToggleVisible}
          onUpdateItem={handleUpdateItem}
          onAddItem={handleAddItem}
          onSwitchScene={handleSwitchScene}
          onReorder={handleReorder}
          onRevertItem={handleRevertItem}
          streaming={streaming}
          onStartStream={handleStartStream}
          onStopStream={handleStopStream}
          streamSettings={streamSettings}
        />
      </div>
    </div>
  );
}
