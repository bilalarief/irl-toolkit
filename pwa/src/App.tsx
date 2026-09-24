import { useEffect, useMemo, useState } from 'react';
import { useWebSocket } from './connection/useWebSocket';
import { Canvas } from './editor/Canvas';
import type { EditorScene } from './protocol/types';
import { createEditorStore } from './state/editorStore';

const store = createEditorStore();

export default function App() {
  const { status, lastMessage, send, connect, disconnect, url, setUrl } = useWebSocket();
  const [sceneTick, setSceneTick] = useState(0);
  const [, force] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [wsInput, setWsInput] = useState(url);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // subscribe to editor store
  useEffect(() => store.subscribe(() => force((x) => x + 1)), []);

  // handle incoming scene_state / save_result
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
          // fallback: update original from current
          store.setScene(store.current);
        }
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        setSaveStatus('error');
        alert(`Save failed: ${lastMessage.error ?? 'unknown'}`);
      }
    }
  }, [lastMessage]);

  const scene: EditorScene | null = store.current;

  const hasChanges = useMemo(() => store.hasChanges(), [sceneTick, scene]);

  const handleMove = (id: number, x: number, y: number) => {
    store.updateItem(id, { x, y });
    force((v) => v + 1);
  };

  const handleDelete = () => {
    if (selectedId == null || !store.current) return;
    store.current.items = store.current.items.filter((i) => i.sceneItemId !== selectedId);
    setSelectedId(null);
    force((v) => v + 1);
  };

  const handleSave = () => {
    const diff = store.computeDiff();
    if (diff.length === 0) return;
    // Convert {sceneItemId, patch} to flat changes for plugin
    const changes = diff.map((d) => ({ sceneItemId: d.sceneItemId, ...d.patch }));
    const ok = send({ type: 'save_changes', changes, requestId: `save-${Date.now()}` } as const);
    if (!ok) {
      alert('Not connected to OBS plugin');
      return;
    }
    setSaveStatus('saving');
    // eslint-disable-next-line no-console
    console.log('Save diff', changes);
  };

  const handleRefresh = () => {
    send({ type: 'get_scene', requestId: `r-${Date.now()}` });
  };

  return (
    <div className="app">
      <header className="header">
        <div className="brand">IRL TOOLKIT</div>
        <div className={`conn ${status}`}>
          <span className="dot" /> {status}
        </div>
      </header>

      {/* Connection */}
      <div className="section">
        <p className="section-title">PHONE → OBS</p>
        <div className="card">
          <div style={{ fontSize: 13, color: '#d1d5db', marginBottom: 8, fontFamily: 'monospace' }}>{url}</div>
          <div className="row">
            <input className="input" value={wsInput} onChange={(e) => setWsInput(e.target.value)} placeholder="ws://host:8087" />
            <button
              className="btn btn-ghost"
              onClick={() => {
                setUrl(wsInput);
                disconnect();
                setTimeout(connect, 100);
              }}
              style={{ flex: '0 0 84px' }}
            >
              Apply
            </button>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn btn-ghost" onClick={status === 'connected' ? disconnect : connect}>
              {status === 'connected' ? 'Disconnect' : 'Connect'}
            </button>
            <button className="btn btn-ghost" onClick={handleRefresh} disabled={status !== 'connected'}>
              Get Scene
            </button>
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 8 }}>
            On phone, open PWA via <code>http://&lt;PC-IP&gt;:5173</code> and use <code>ws://&lt;PC-IP&gt;:8087</code>
          </div>
        </div>
      </div>

      {/* Scene */}
      <div className="section" style={{ flex: 1 }}>
        <p className="section-title">SCENE</p>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{scene ? scene.name : '— not loaded —'}</div>

        <Canvas scene={scene} selectedId={selectedId} onSelect={setSelectedId} onMove={handleMove} />

        {scene && (
          <div style={{ marginTop: 12 }} className="item-list">
            {scene.items.map((it) => (
              <div key={it.sceneItemId} className={`item-row ${selectedId === it.sceneItemId ? 'active' : ''}`} onClick={() => setSelectedId(it.sceneItemId)}>
                <div>
                  <div style={{ fontWeight: 700 }}>{it.sourceName}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>
                    #{it.sceneItemId} {it.sourceType} · {Math.round(it.x)},{Math.round(it.y)} · {Math.round(it.width)}×{Math.round(it.height)} {it.visible ? '' : '· hidden'}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: '#a78bfa' }}>{it.visible ? '●' : '○'}</div>
              </div>
            ))}
          </div>
        )}

        {selectedId != null && (
          <div className="card" style={{ marginTop: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Selected #{selectedId}</div>
            <div className="row">
              <button className="btn btn-danger" onClick={handleDelete}>
                Delete
              </button>
              <button className="btn btn-ghost" onClick={() => setSelectedId(null)}>
                Deselect
              </button>
            </div>
          </div>
        )}
      </div>

      {hasChanges && <div className="unsaved">Unsaved changes — press Save</div>}

      <div className="bottom-bar">
        <button className="btn btn-ghost" onClick={() => alert('+ Overlay — coming soon: camera/image/text/browser')}>
          + Overlay
        </button>
        <button className="btn btn-primary" onClick={handleSave} disabled={!hasChanges || saveStatus === 'saving' || status !== 'connected'}>
          {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved!' : 'SAVE'}
        </button>
      </div>

      <div style={{ padding: 12, textAlign: 'center', fontSize: 10, color: '#6b7280' }}>
        <button className="btn btn-ghost" onClick={() => { store.discard(); setSelectedId(null); }} disabled={!hasChanges} style={{ minHeight: 36, fontSize: 12 }}>
          Discard
        </button>
        <div style={{ marginTop: 8 }}>Local edits until Save — OBS unchanged while dragging.</div>
      </div>
    </div>
  );
}
