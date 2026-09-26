import { useState, useEffect } from 'react';
import type { EditorItem, EditorScene } from '../protocol/types';

export type DrawerType = 'none' | 'menu' | 'obs_settings' | 'scene_changer' | 'overlays_list' | 'edit_overlay' | 'add_overlay';

interface DrawersProps {
  drawer: DrawerType;
  setDrawer: (d: DrawerType) => void;
  scene: EditorScene | null;
  scenes: string[];
  selectedItem: EditorItem | null;
  onSelectItem: (id: number) => void;
  onUpdateScene: () => void;
  onDisconnect: () => void;
  onSave: () => void;
  onDelete: (id: number) => void;
  onToggleVisible: (id: number, visible: boolean) => void;
  onUpdateItem: (id: number, patch: Partial<EditorItem>) => void;
  onAddItem: (name: string, width: number, height: number) => void;
  onSwitchScene: (name: string) => void;
}

export function Drawers({
  drawer,
  setDrawer,
  scene,
  scenes,
  selectedItem,
  onSelectItem,
  onUpdateScene,
  onDisconnect,
  onSave,
  onDelete,
  onToggleVisible,
  onUpdateItem,
  onAddItem,
  onSwitchScene,
}: DrawersProps) {
  // Form states for Add / Edit
  const [editWidth, setEditWidth] = useState<string>('');
  const [editHeight, setEditHeight] = useState<string>('');
  const [addName, setAddName] = useState<string>('');
  const [addUrl, setAddUrl] = useState<string>('');
  const [addWidth, setAddWidth] = useState<string>('600');
  const [addHeight, setAddHeight] = useState<string>('1280');
  const [addVisible, setAddVisible] = useState<boolean>(true);

  useEffect(() => {
    if (selectedItem) {
      setEditWidth(Math.round(selectedItem.width * selectedItem.scaleX).toString());
      setEditHeight(Math.round(selectedItem.height * selectedItem.scaleY).toString());
    }
  }, [selectedItem]);

  if (drawer === 'none') return null;

  return (
    <div
      className="custom-scroll"
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'flex-end',
        width: '100%',
        height: '100%',
        position: 'absolute',
        left: 0,
        top: 0,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        padding: '16px 20px',
        boxSizing: 'border-box',
        background: 'linear-gradient(to right, rgba(17,17,17,0) 0%, rgba(17,17,17,0.85) 45%, #111111 92%)',
        zIndex: 35,
        pointerEvents: 'auto',
      }}
    >
      {/* ==================== 1. MAIN MENU DRAWER ==================== */}
      {drawer === 'menu' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 14, marginTop: 12 }}>
          {/* Back */}
          <button
            type="button"
            onClick={() => setDrawer('none')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '7px 14px',
              borderRadius: 999,
              border: '1px dashed #636363',
              background: 'transparent',
              cursor: 'pointer',
              color: '#fff',
              fontSize: 18,
              fontWeight: 600,
              fontFamily: 'inherit',
            }}
          >
            <span>Back</span>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6.53328 11.4583L7.64162 10.2167L5.53328 8.34168H12.5083C14.35 8.34168 15.8416 9.83335 15.8416 11.675C15.8416 13.5167 14.35 15.0083 12.5083 15.0083H10.0083V16.675H12.5083C15.2666 16.675 17.5083 14.4333 17.5083 11.675C17.5083 8.91668 15.2666 6.67502 12.5083 6.67502H5.52495L7.63328 4.80002L6.52495 3.55835L2.07495 7.51668L6.52495 11.475L6.53328 11.4583Z" fill="white" />
            </svg>
          </button>

          {/* OBS Settings */}
          <button
            type="button"
            onClick={() => setDrawer('obs_settings')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '8px 18px',
              borderRadius: 999,
              border: '1px dashed #636363',
              background: 'transparent',
              cursor: 'pointer',
              color: '#fff',
              fontSize: 18,
              fontWeight: 600,
              fontFamily: 'inherit',
            }}
          >
            <span>OBS Settings</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>

          {/* Scene Changer */}
          <button
            type="button"
            onClick={() => setDrawer('scene_changer')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '8px 18px',
              borderRadius: 999,
              border: '1px dashed #636363',
              background: 'transparent',
              cursor: 'pointer',
              color: '#fff',
              fontSize: 18,
              fontWeight: 600,
              fontFamily: 'inherit',
            }}
          >
            <span>Scene Changer</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="17 1 21 5 17 9" />
              <path d="M3 5h18" />
              <polyline points="7 23 3 19 7 15" />
              <path d="M21 19H3" />
            </svg>
          </button>

          {/* Overlays */}
          <button
            type="button"
            onClick={() => setDrawer('overlays_list')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '8px 18px',
              borderRadius: 999,
              border: '1px dashed #636363',
              background: 'transparent',
              cursor: 'pointer',
              color: '#fff',
              fontSize: 18,
              fontWeight: 600,
              fontFamily: 'inherit',
            }}
          >
            <span>Overlays</span>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.5 2.5H2.50004C1.58337 2.5 0.833374 3.25 0.833374 4.16667V15.8333C0.833374 16.75 1.58337 17.5 2.50004 17.5H17.5C18.4167 17.5 19.1667 16.75 19.1667 15.8333V4.16667C19.1667 3.25 18.4167 2.5 17.5 2.5ZM17.5 15.8333H2.50004V4.16667H17.5V15.8333ZM9.16671 10H16.6667V15H9.16671V10Z" fill="white" />
            </svg>
          </button>
        </div>
      )}

      {/* ==================== 2. OBS SETTINGS DRAWER ==================== */}
      {drawer === 'obs_settings' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 14, marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 18px', borderRadius: 999, border: '1px solid #fff', background: 'rgba(255,255,255,0.12)', color: '#fff', fontSize: 18, fontWeight: 600 }}>
            <span>OBS Settings</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </div>

          <button
            type="button"
            onClick={onUpdateScene}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 18px', borderRadius: 999, border: '1px dashed #636363', background: 'transparent', color: '#fff', fontSize: 18, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <span>Update Scene</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>

          <button
            type="button"
            onClick={onDisconnect}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 18px', borderRadius: 999, border: '1px dashed #ff5151', background: 'transparent', color: '#ff5151', fontSize: 18, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <span>Disconnect</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff5151" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18.84 12.25l1.72-1.71a4.5 4.5 0 0 0-6.36-6.36l-1.72 1.71" />
              <path d="M5.16 11.75l-1.72 1.71a4.5 4.5 0 0 0 6.36 6.36l1.72-1.71" />
              <line x1="2" y1="2" x2="22" y2="22" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => setDrawer('menu')}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px', borderRadius: 999, border: '1px dashed #636363', background: 'transparent', color: '#fff', fontSize: 18, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <span>Back</span>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6.53328 11.4583L7.64162 10.2167L5.53328 8.34168H12.5083C14.35 8.34168 15.8416 9.83335 15.8416 11.675C15.8416 13.5167 14.35 15.0083 12.5083 15.0083H10.0083V16.675H12.5083C15.2666 16.675 17.5083 14.4333 17.5083 11.675C17.5083 8.91668 15.2666 6.67502 12.5083 6.67502H5.52495L7.63328 4.80002L6.52495 3.55835L2.07495 7.51668L6.52495 11.475L6.53328 11.4583Z" fill="white" />
            </svg>
          </button>
        </div>
      )}

      {/* ==================== 3. SCENE CHANGER DRAWER ==================== */}
      {drawer === 'scene_changer' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10, width: 186 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 14px', borderRadius: 999, border: '1px solid #fff', background: 'rgba(255,255,255,0.12)', color: '#fff', fontSize: 16, fontWeight: 600 }}>
            <span>Scene Changer</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="17 1 21 5 17 9" />
              <path d="M3 5h18" />
              <polyline points="7 23 3 19 7 15" />
              <path d="M21 19H3" />
            </svg>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
            {scenes.length === 0 && (
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', textAlign: 'right' }}>No scenes found</div>
            )}
            {scenes.map((name) => {
              const isCurrent = name === scene?.name;
              return (
                <div
                  key={name}
                  onClick={() => onSwitchScene(name)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: isCurrent ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    padding: '7px 10px',
                    border: isCurrent ? '1px solid rgba(255,255,255,0.3)' : '1px solid #4d4d4d',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>{name}</span>
                  {isCurrent && (
                    <span style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4 }}>Current</span>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 7, marginTop: 4 }}>
            <button
              type="button"
              onClick={onSave}
              style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Save Changes
            </button>
            <button
              type="button"
              onClick={() => setDrawer('menu')}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999, border: '1px dashed #636363', background: 'transparent', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <span>Back</span>
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6.53328 11.4583L7.64162 10.2167L5.53328 8.34168H12.5083C14.35 8.34168 15.8416 9.83335 15.8416 11.675C15.8416 13.5167 14.35 15.0083 12.5083 15.0083H10.0083V16.675H12.5083C15.2666 16.675 17.5083 14.4333 17.5083 11.675C17.5083 8.91668 15.2666 6.67502 12.5083 6.67502H5.52495L7.63328 4.80002L6.52495 3.55835L2.07495 7.51668L6.52495 11.475L6.53328 11.4583Z" fill="white" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ==================== 4. OVERLAYS LIST DRAWER ==================== */}
      {drawer === 'overlays_list' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10, width: 186 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 10px', borderRadius: 999, border: '1px solid #fff', color: '#fff', fontSize: 12, fontWeight: 600 }}>
            <span>Overlays</span>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.5 2.5H2.50004C1.58337 2.5 0.833374 3.25 0.833374 4.16667V15.8333C0.833374 16.75 1.58337 17.5 2.50004 17.5H17.5C18.4167 17.5 19.1667 16.75 19.1667 15.8333V4.16667C19.1667 3.25 18.4167 2.5 17.5 2.5ZM17.5 15.8333H2.50004V4.16667H17.5V15.8333ZM9.16671 10H16.6667V15H9.16671V10Z" fill="white" />
            </svg>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', maxHeight: 220, overflowY: 'auto' }}>
            {scene?.items.map((it) => (
              <div
                key={it.sceneItemId}
                onClick={() => {
                  onSelectItem(it.sceneItemId);
                  setDrawer('edit_overlay');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: selectedItem?.sceneItemId === it.sceneItemId ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)',
                  border: '1px solid #4d4d4d',
                  boxSizing: 'border-box',
                  cursor: 'pointer',
                }}
              >
                <svg width="10" height="14" viewBox="0 0 10 14" fill="#a1a1aa">
                  <circle cx="2" cy="2" r="1.5" />
                  <circle cx="8" cy="2" r="1.5" />
                  <circle cx="2" cy="7" r="1.5" />
                  <circle cx="8" cy="7" r="1.5" />
                  <circle cx="2" cy="12" r="1.5" />
                  <circle cx="8" cy="12" r="1.5" />
                </svg>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {it.sourceName}
                </span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, marginTop: 4 }}>
            <button
              type="button"
              onClick={() => setDrawer('add_overlay')}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', borderRadius: 999, border: '1px dashed #636363', background: 'transparent', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <span>Add Overlay</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>

            <button
              type="button"
              onClick={onSave}
              style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Save Changes
            </button>

            <button
              type="button"
              onClick={() => setDrawer('menu')}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999, border: '1px dashed #636363', background: 'transparent', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <span>Back</span>
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6.53328 11.4583L7.64162 10.2167L5.53328 8.34168H12.5083C14.35 8.34168 15.8416 9.83335 15.8416 11.675C15.8416 13.5167 14.35 15.0083 12.5083 15.0083H10.0083V16.675H12.5083C15.2666 16.675 17.5083 14.4333 17.5083 11.675C17.5083 8.91668 15.2666 6.67502 12.5083 6.67502H5.52495L7.63328 4.80002L6.52495 3.55835L2.07495 7.51668L6.52495 11.475L6.53328 11.4583Z" fill="white" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ==================== 5. EDIT OVERLAY DRAWER ==================== */}
      {drawer === 'edit_overlay' && selectedItem && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 14 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 10px', borderRadius: 999, border: '1px solid #fff', color: '#fff', fontSize: 12, fontWeight: 600 }}>
              <span>{selectedItem.sourceName}</span>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.5 2.5H2.50004C1.58337 2.5 0.833374 3.25 0.833374 4.16667V15.8333C0.833374 16.75 1.58337 17.5 2.50004 17.5H17.5C18.4167 17.5 19.1667 16.75 19.1667 15.8333V4.16667C19.1667 3.25 18.4167 2.5 17.5 2.5ZM17.5 15.8333H2.50004V4.16667H17.5V15.8333ZM9.16671 10H16.6667V15H9.16671V10Z" fill="white" />
              </svg>
            </div>

            {/* Inputs */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
              {/* Hide / Visible Switcher */}
              <div style={{ display: 'flex', padding: 2, borderRadius: 12, background: 'rgba(255,255,255,0.05)' }}>
                <div
                  onClick={() => onToggleVisible(selectedItem.sceneItemId, false)}
                  style={{ width: 90, padding: '7px 6px', borderRadius: 10, background: !selectedItem.visible ? 'rgba(255,255,255,0.12)' : 'transparent', textAlign: 'center', color: !selectedItem.visible ? '#fff' : 'rgba(255,255,255,0.65)', fontWeight: !selectedItem.visible ? 600 : 400, fontSize: 13, cursor: 'pointer' }}
                >
                  Hide
                </div>
                <div
                  onClick={() => onToggleVisible(selectedItem.sceneItemId, true)}
                  style={{ width: 90, padding: '7px 6px', borderRadius: 10, background: selectedItem.visible ? 'rgba(255,255,255,0.12)' : 'transparent', textAlign: 'center', color: selectedItem.visible ? '#fff' : 'rgba(255,255,255,0.65)', fontWeight: selectedItem.visible ? 600 : 400, fontSize: 13, cursor: 'pointer' }}
                >
                  Visible
                </div>
              </div>

              {/* Width */}
              <div style={{ width: 186, padding: '7px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.1)', border: '1px solid #4d4d4d', boxSizing: 'border-box' }}>
                <div style={{ display: 'inline-block', padding: '2px 6px', borderRadius: 2, background: 'rgba(255,255,255,0.1)', fontSize: 10, color: '#fff', marginBottom: 4 }}>
                  Width
                </div>
                <input
                  type="number"
                  value={editWidth}
                  onChange={(e) => {
                    setEditWidth(e.target.value);
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val) && val > 0) onUpdateItem(selectedItem.sceneItemId, { width: val });
                  }}
                  style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: 13, fontFamily: 'inherit' }}
                />
              </div>

              {/* Height */}
              <div style={{ width: 186, padding: '7px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.1)', border: '1px solid #4d4d4d', boxSizing: 'border-box' }}>
                <div style={{ display: 'inline-block', padding: '2px 6px', borderRadius: 2, background: 'rgba(255,255,255,0.1)', fontSize: 10, color: '#fff', marginBottom: 4 }}>
                  Height
                </div>
                <input
                  type="number"
                  value={editHeight}
                  onChange={(e) => {
                    setEditHeight(e.target.value);
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val) && val > 0) onUpdateItem(selectedItem.sceneItemId, { height: val });
                  }}
                  style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: 13, fontFamily: 'inherit' }}
                />
              </div>
            </div>

            {/* Buttons Row */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setDrawer('overlays_list')}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 999, border: '1px dashed #636363', background: 'transparent', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  <span>Undo</span>
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6.53328 11.4583L7.64162 10.2167L5.53328 8.34168H12.5083C14.35 8.34168 15.8416 9.83335 15.8416 11.675C15.8416 13.5167 14.35 15.0083 12.5083 15.0083H10.0083V16.675H12.5083C15.2666 16.675 17.5083 14.4333 17.5083 11.675C17.5083 8.91668 15.2666 6.67502 12.5083 6.67502H5.52495L7.63328 4.80002L6.52495 3.55835L2.07495 7.51668L6.52495 11.475L6.53328 11.4583Z" fill="white" />
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onDelete(selectedItem.sceneItemId);
                    setDrawer('overlays_list');
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 999, border: '1px dashed #ff5151', background: 'transparent', color: '#ff5151', fontSize: 16, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  <span>Delete</span>
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8.33329 1.875C8.16753 1.875 8.00856 1.94085 7.89135 2.05806C7.77414 2.17527 7.70829 2.33424 7.70829 2.5V3.125H4.16663C4.00087 3.125 3.84189 3.19085 3.72468 3.30806C3.60747 3.42527 3.54163 3.58424 3.54163 3.75C3.54163 3.91576 3.60747 4.07473 3.72468 4.19194C3.84189 4.30915 4.00087 4.375 4.16663 4.375H15.8333C15.9991 4.375 16.158 4.30915 16.2752 4.19194C16.3924 4.07473 16.4583 3.91576 16.4583 3.75C16.4583 3.58424 16.3924 3.42527 16.2752 3.30806C16.158 3.19085 15.9991 3.125 15.8333 3.125H12.2916V2.5C12.2916 2.33424 12.2258 2.17527 12.1086 2.05806C11.9914 1.94085 11.8324 1.875 11.6666 1.875H8.33329ZM8.33329 8.875C8.49905 8.875 8.65802 8.94085 8.77523 9.05806C8.89244 9.17527 8.95829 9.33424 8.95829 9.5V15.3333C8.95829 15.4991 8.89244 15.6581 8.77523 15.7753C8.65802 15.8925 8.49905 15.9583 8.33329 15.9583C8.16753 15.9583 8.00856 15.8925 7.89135 15.7753C7.77414 15.6581 7.70829 15.4991 7.70829 15.3333V9.5C7.70829 9.33424 7.77414 9.17527 7.89135 9.05806C8.00856 8.94085 8.16753 8.875 8.33329 8.875ZM12.2916 9.5C12.2916 9.33424 12.2258 9.17527 12.1086 9.05806C11.9914 8.94085 11.8324 8.875 11.6666 8.875C11.5009 8.875 11.3419 8.94085 11.2247 9.05806C11.1075 9.17527 11.0416 9.33424 11.0416 9.5V15.3333C11.0416 15.4991 11.1075 15.6581 11.2247 15.7753C11.3419 15.8925 11.5009 15.9583 11.6666 15.9583C11.8324 15.9583 11.9914 15.8925 12.1086 15.7753C12.2258 15.6581 12.2916 15.4991 12.2916 15.3333V9.5Z" fill="#FF5151" />
                    <path fillRule="evenodd" clipRule="evenodd" d="M4.99249 6.59758C5.00952 6.44466 5.08236 6.30339 5.19707 6.20083C5.31177 6.09826 5.46028 6.04162 5.61415 6.04175H14.3858C14.5397 6.04162 14.6882 6.09826 14.8029 6.20083C14.9176 6.30339 14.9905 6.44466 15.0075 6.59758L15.1742 8.09925C15.4767 10.8201 15.4767 13.5659 15.1742 16.2876L15.1575 16.4351C15.0995 16.9602 14.8681 17.451 14.4998 17.8299C14.1315 18.2087 13.6474 18.4539 13.1242 18.5267C11.0515 18.8174 8.94846 18.8174 6.87582 18.5267C6.35253 18.4539 5.86845 18.2087 5.50018 17.8299C5.13191 17.451 4.90048 16.9602 4.84249 16.4351L4.82582 16.2876C4.52355 13.5665 4.52355 10.8203 4.82582 8.09925L4.99249 6.59758ZM6.17332 7.29175L6.06832 8.23675C5.77623 10.8662 5.77623 13.5198 6.06832 16.1492L6.08499 16.2967C6.11215 16.546 6.22176 16.779 6.39644 16.9588C6.57111 17.1386 6.80084 17.2549 7.04915 17.2892C9.00749 17.5634 10.9933 17.5634 12.9508 17.2892C13.199 17.2549 13.4286 17.1387 13.6033 16.9591C13.778 16.7794 13.8877 16.5466 13.915 16.2976L13.9317 16.1492C14.2233 13.5201 14.2233 10.8659 13.9317 8.23675L13.8267 7.29175H6.17332Z" fill="#FF5151" />
                  </svg>
                </button>
              </div>

              <button
                type="button"
                onClick={onSave}
                style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Save Changes
              </button>
            </div>
          </div>

          {/* Scrollbar */}
          <div style={{ width: 4, height: 326, borderRadius: 999, background: 'rgba(255,255,255,0.1)', position: 'relative' }}>
            <div style={{ width: 4, height: 288, borderRadius: 999, background: 'rgba(255,255,255,0.2)', position: 'absolute', top: 0, left: 0 }} />
          </div>
        </div>
      )}

      {/* ==================== 6. ADD OVERLAY DRAWER ==================== */}
      {drawer === 'add_overlay' && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 10px', borderRadius: 999, border: '1px solid #fff', color: '#fff', fontSize: 12, fontWeight: 600 }}>
              <span>Overlays</span>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.5 2.5H2.50004C1.58337 2.5 0.833374 3.25 0.833374 4.16667V15.8333C0.833374 16.75 1.58337 17.5 2.50004 17.5H17.5C18.4167 17.5 19.1667 16.75 19.1667 15.8333V4.16667C19.1667 3.25 18.4167 2.5 17.5 2.5ZM17.5 15.8333H2.50004V4.16667H17.5V15.8333ZM9.16671 10H16.6667V15H9.16671V10Z" fill="white" />
              </svg>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
              {/* Hide / Visible Switcher */}
              <div style={{ display: 'flex', padding: 2, borderRadius: 12, background: 'rgba(255,255,255,0.05)' }}>
                <div
                  onClick={() => setAddVisible(false)}
                  style={{ width: 90, padding: '7px 6px', borderRadius: 10, background: !addVisible ? 'rgba(255,255,255,0.12)' : 'transparent', textAlign: 'center', color: !addVisible ? '#fff' : 'rgba(255,255,255,0.65)', fontWeight: !addVisible ? 600 : 400, fontSize: 13, cursor: 'pointer' }}
                >
                  Hide
                </div>
                <div
                  onClick={() => setAddVisible(true)}
                  style={{ width: 90, padding: '7px 6px', borderRadius: 10, background: addVisible ? 'rgba(255,255,255,0.12)' : 'transparent', textAlign: 'center', color: addVisible ? '#fff' : 'rgba(255,255,255,0.65)', fontWeight: addVisible ? 600 : 400, fontSize: 13, cursor: 'pointer' }}
                >
                  Visible
                </div>
              </div>

              {/* Name */}
              <div style={{ width: 186, padding: '7px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.1)', border: '1px solid #4d4d4d', boxSizing: 'border-box' }}>
                <div style={{ display: 'inline-block', padding: '2px 6px', borderRadius: 2, background: 'rgba(255,255,255,0.1)', fontSize: 10, color: '#fff', marginBottom: 4 }}>
                  Overlay Name
                </div>
                <input
                  type="text"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="e.g. Chat Overlay"
                  style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: 13, fontFamily: 'inherit' }}
                />
              </div>

              {/* URL */}
              <div style={{ width: 186, padding: '7px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.1)', border: '1px solid #4d4d4d', boxSizing: 'border-box' }}>
                <div style={{ display: 'inline-block', padding: '2px 6px', borderRadius: 2, background: 'rgba(255,255,255,0.1)', fontSize: 10, color: '#fff', marginBottom: 4 }}>
                  URL
                </div>
                <input
                  type="text"
                  value={addUrl}
                  onChange={(e) => setAddUrl(e.target.value)}
                  placeholder="https://..."
                  style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: 13, fontFamily: 'inherit' }}
                />
              </div>

              {/* Width */}
              <div style={{ width: 186, padding: '7px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.1)', border: '1px solid #4d4d4d', boxSizing: 'border-box' }}>
                <div style={{ display: 'inline-block', padding: '2px 6px', borderRadius: 2, background: 'rgba(255,255,255,0.1)', fontSize: 10, color: '#fff', marginBottom: 4 }}>
                  Width
                </div>
                <input
                  type="number"
                  value={addWidth}
                  onChange={(e) => setAddWidth(e.target.value)}
                  style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: 13, fontFamily: 'inherit' }}
                />
              </div>

              {/* Height */}
              <div style={{ width: 186, padding: '7px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.1)', border: '1px solid #4d4d4d', boxSizing: 'border-box' }}>
                <div style={{ display: 'inline-block', padding: '2px 6px', borderRadius: 2, background: 'rgba(255,255,255,0.1)', fontSize: 10, color: '#fff', marginBottom: 4 }}>
                  Height
                </div>
                <input
                  type="number"
                  value={addHeight}
                  onChange={(e) => setAddHeight(e.target.value)}
                  style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: 13, fontFamily: 'inherit' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setDrawer('overlays_list')}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 999, border: '1px dashed #636363', background: 'transparent', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  <span>Undo</span>
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6.53328 11.4583L7.64162 10.2167L5.53328 8.34168H12.5083C14.35 8.34168 15.8416 9.83335 15.8416 11.675C15.8416 13.5167 14.35 15.0083 12.5083 15.0083H10.0083V16.675H12.5083C15.2666 16.675 17.5083 14.4333 17.5083 11.675C17.5083 8.91668 15.2666 6.67502 12.5083 6.67502H5.52495L7.63328 4.80002L6.52495 3.55835L2.07495 7.51668L6.52495 11.475L6.53328 11.4583Z" fill="white" />
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const w = parseFloat(addWidth) || 600;
                    const h = parseFloat(addHeight) || 1280;
                    onAddItem(addName || 'New Overlay', w, h);
                    setDrawer('overlays_list');
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 999, border: '1px solid #fac800', background: '#fac800', color: '#111', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  <span>Add</span>
                </button>
              </div>

              <button
                type="button"
                onClick={onSave}
                style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Save Changes
              </button>
            </div>
          </div>

          <div style={{ width: 4, height: 326, borderRadius: 999, background: 'rgba(255,255,255,0.1)', position: 'relative' }}>
            <div style={{ width: 4, height: 288, borderRadius: 999, background: 'rgba(255,255,255,0.2)', position: 'absolute', top: 0, left: 0 }} />
          </div>
        </div>
      )}
    </div>
  );
}
