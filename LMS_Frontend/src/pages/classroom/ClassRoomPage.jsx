import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  LiveKitRoom,
  VideoConference,
  PreJoin,
  useRoomContext,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { ArrowLeft, GraduationCap, LogOut, Radio, TriangleAlert } from 'lucide-react';
import { UserRole } from '@/shared';
import { Button, Spinner } from '@/components/ui';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useLiveToken } from '@/lib/live';
import './classroom.css';

/** Branded in-room header with a Leave control (lives inside LiveKitRoom). */
function RoomHeader({ title, subtitle, host, onLeave }) {
  const room = useRoomContext();
  const leave = async () => {
    try { await room.disconnect(); } catch { /* ignore */ }
    onLeave?.();
  };
  return (
    <header className="lk-topbar">
      <div className="lk-topbar__brand">
        <span className="lk-topbar__logo"><GraduationCap size={18} strokeWidth={2.2} /></span>
        <div className="lk-topbar__titles">
          <div className="lk-topbar__title">{title}</div>
          {subtitle && <div className="lk-topbar__sub">{subtitle}</div>}
        </div>
      </div>
      <div className="lk-topbar__right">
        <span className="lk-live"><Radio size={13} strokeWidth={2.6} /> LIVE</span>
        {host && <span className="lk-host-pill">Host</span>}
        <button type="button" className="lk-leave" onClick={leave}>
          <LogOut size={15} strokeWidth={2.2} /> Leave
        </button>
      </div>
    </header>
  );
}

export function ClassRoomPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const role = useAuth((s) => s.user?.role);
  const userName = useAuth((s) => s.user?.name);
  const { data, isLoading, isError, error } = useLiveToken(id);
  const [choices, setChoices] = useState(null); // PreJoin selections
  const [left, setLeft] = useState(false);

  // Best-effort attendance: record entry for a student who lands here directly.
  useEffect(() => {
    if (role === UserRole.STUDENT && id) api.post(`/classes/${id}/join`).catch(() => {});
  }, [role, id]);

  const backToSchedule = () => navigate('/app/schedule');

  if (isLoading) {
    return (
      <div className="lk-shell lk-center" data-lk-theme="default">
        <div className="lk-status"><Spinner size={34} /><p>Preparing your live class…</p></div>
      </div>
    );
  }

  if (isError || !data?.token || !data?.url) {
    return (
      <div className="lk-shell lk-center" data-lk-theme="default">
        <div className="lk-card lk-card--error">
          <div className="lk-card__icon lk-card__icon--error"><TriangleAlert size={26} /></div>
          <h2>Can’t join this class</h2>
          <p>{isError ? apiErrorMessage(error) : 'This class isn’t available for an in-app session.'}</p>
          <Button variant="outline" onClick={backToSchedule}><ArrowLeft size={15} /> Back to schedule</Button>
        </div>
      </div>
    );
  }

  if (left) {
    return (
      <div className="lk-shell lk-center" data-lk-theme="default">
        <div className="lk-card">
          <div className="lk-card__icon"><GraduationCap size={26} /></div>
          <h2>You’ve left the class</h2>
          <p>{data.classTitle}{data.trainerName ? ` · ${data.trainerName}` : ''}</p>
          <div className="lk-card__actions">
            <Button variant="outline" onClick={backToSchedule}><ArrowLeft size={15} /> Back to schedule</Button>
            <Button onClick={() => { setLeft(false); setChoices(null); }}>Rejoin class</Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Pre-join: device + camera setup ──────────────────────────────────────────
  if (!choices) {
    return (
      <div className="lk-shell lk-center" data-lk-theme="default">
        <div className="lk-prejoin">
          <div className="lk-prejoin__head">
            <span className="lk-topbar__logo"><GraduationCap size={18} strokeWidth={2.2} /></span>
            <div>
              <div className="lk-prejoin__title">{data.classTitle || 'Live class'}</div>
              <div className="lk-prejoin__sub">
                {data.trainerName ? `with ${data.trainerName}` : 'Set up your camera & mic before joining'}
              </div>
            </div>
          </div>
          <PreJoin
            defaults={{ username: userName || 'Participant', videoEnabled: data.host ?? false, audioEnabled: data.host ?? false }}
            onSubmit={(values) => setChoices(values)}
            joinLabel="Join class"
            persistUserChoices
          />
        </div>
      </div>
    );
  }

  // ── Live room ────────────────────────────────────────────────────────────────
  return (
    <div className="lk-shell" data-lk-theme="default">
      <LiveKitRoom
        token={data.token}
        serverUrl={data.url}
        connect
        video={choices.videoEnabled}
        audio={choices.audioEnabled}
        onDisconnected={() => setLeft(true)}
        onError={() => setLeft(true)}
        style={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}
      >
        <RoomHeader
          title={data.classTitle || 'Live class'}
          subtitle={[data.moduleName, data.trainerName].filter(Boolean).join(' · ')}
          host={data.host}
          onLeave={() => setLeft(true)}
        />
        <div className="lk-stage">
          {/* Prebuilt, fully-featured conference (grid/spotlight, screen-share,
              chat, device controls) — themed to our brand via classroom.css. */}
          <VideoConference />
        </div>
      </LiveKitRoom>
    </div>
  );
}
