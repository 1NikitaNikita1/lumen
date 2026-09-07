import { useCallback, useEffect, useRef, useState } from "react";
import ColorPalette from "./ColorPalette";
import { TelegramClient, type TelegramStatus } from "../telegram/TelegramClient";
import { audioEngine } from "../audio/AudioEngine";
import { COLOR_NOTES, messageToNoteEvents, type ComboRule, type NoteEvent } from "../audio/noteMapping";

type LogEntry = {
  id: number;
  chatTitle: string;
  fromLabel: string;
  text: string;
};

type LiveNote = {
  id: number;
  color: string;
};

const NOTE_SPACING_MS = 110;
const MAX_LOG = 20;
const MAX_LIVE_NOTES = 60;

let idCounter = 0;
const nextId = () => (idCounter += 1);

function makeCombo(): ComboRule {
  return { id: `combo-${nextId()}`, pattern: "", color: COLOR_NOTES[0].color, height: 0.5 };
}

export default function TelegramStage() {
  const clientRef = useRef<TelegramClient | null>(null);
  const combosRef = useRef<ComboRule[]>([]);

  const [token, setToken] = useState("");
  const [chatFilter, setChatFilter] = useState("");
  const [status, setStatus] = useState<TelegramStatus>("idle");
  const [statusDetail, setStatusDetail] = useState<string | undefined>();
  const [combos, setCombos] = useState<ComboRule[]>([
    { id: "combo-heart", pattern: "❤", color: COLOR_NOTES[0].color, height: 0.7 },
    { id: "combo-smile", pattern: ":)", color: COLOR_NOTES[2].color, height: 0.85 },
  ]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [liveNotes, setLiveNotes] = useState<LiveNote[]>([]);

  useEffect(() => {
    combosRef.current = combos;
  }, [combos]);

  useEffect(() => {
    return () => {
      clientRef.current?.disconnect();
    };
  }, []);

  const pushLiveNote = useCallback((color: string) => {
    setLiveNotes((prev) => {
      const next = [...prev, { id: nextId(), color }];
      return next.length > MAX_LIVE_NOTES ? next.slice(next.length - MAX_LIVE_NOTES) : next;
    });
  }, []);

  const playSequence = useCallback(
    (events: NoteEvent[]) => {
      events.forEach((event, index) => {
        window.setTimeout(() => {
          audioEngine.playNote(event.frequency);
          pushLiveNote(event.color);
        }, index * NOTE_SPACING_MS);
      });
    },
    [pushLiveNote]
  );

  const handleConnect = useCallback(() => {
    if (!token.trim()) return;
    audioEngine.init();

    if (!clientRef.current) clientRef.current = new TelegramClient();

    clientRef.current.connect(token, chatFilter, {
      onStatus: (s, detail) => {
        setStatus(s);
        setStatusDetail(detail);
      },
      onMessage: (message) => {
        setLog((prev) => {
          const next = [{ id: nextId(), chatTitle: message.chatTitle, fromLabel: message.fromLabel, text: message.text }, ...prev];
          return next.slice(0, MAX_LOG);
        });
        const events = messageToNoteEvents(message.text, combosRef.current);
        playSequence(events);
      },
    });
  }, [token, chatFilter, playSequence]);

  const handleDisconnect = useCallback(() => {
    clientRef.current?.disconnect();
  }, []);

  function addCombo() {
    setCombos((prev) => [...prev, makeCombo()]);
  }

  function updateCombo(id: string, patch: Partial<ComboRule>) {
    setCombos((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function removeCombo(id: string) {
    setCombos((prev) => prev.filter((c) => c.id !== id));
  }

  const isConnected = status === "connected";
  const isConnecting = status === "connecting";

  return (
    <div className="stage stage--telegram">
      <div className="tg-panel">
        <section className="tg-card">
          <h2 className="tg-card__title">Connect a bot</h2>
          <p className="tg-card__hint">
            Create a bot with <strong>@BotFather</strong>, paste its token below, and (optionally)
            a chat ID to only react to that conversation. Leave the chat ID empty to react to any
            chat the bot can see.
          </p>

          <label className="tg-field">
            <span>Bot token</span>
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="123456789:AA...your bot token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={isConnected || isConnecting}
            />
          </label>

          <label className="tg-field">
            <span>Chat ID (optional)</span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="e.g. 123456789"
              value={chatFilter}
              onChange={(e) => setChatFilter(e.target.value)}
              disabled={isConnected || isConnecting}
            />
          </label>

          <div className="tg-connect-row">
            {isConnected || isConnecting ? (
              <button type="button" className="controls__clear" onClick={handleDisconnect}>
                Disconnect
              </button>
            ) : (
              <button type="button" className="controls__play" onClick={handleConnect} disabled={!token.trim()}>
                Connect
              </button>
            )}
            <span className={`tg-status tg-status--${status}`}>
              {status === "idle" && "Not connected"}
              {status === "connecting" && "Connecting…"}
              {status === "connected" && `Connected ${statusDetail ?? ""}`}
              {status === "error" && `Error: ${statusDetail ?? "unknown"}`}
            </span>
          </div>

          <p className="tg-card__note">
            The token stays in this tab only — it's never saved or sent anywhere but Telegram.
            Only use a bot you control.
          </p>
        </section>

        <section className="tg-card">
          <h2 className="tg-card__title">Symbol combos</h2>
          <p className="tg-card__hint">
            Matched combos play their assigned note; everything else in a message falls back to a
            per-character melody automatically.
          </p>

          <div className="combo-list">
            {combos.map((combo) => (
              <div className="combo-row" key={combo.id}>
                <input
                  type="text"
                  className="combo-row__pattern"
                  placeholder="e.g. lol"
                  value={combo.pattern}
                  onChange={(e) => updateCombo(combo.id, { pattern: e.target.value })}
                />
                <ColorPalette
                  size="small"
                  activeColor={combo.color}
                  onSelect={(color) => updateCombo(combo.id, { color })}
                />
                <input
                  type="range"
                  className="combo-row__height"
                  min={0}
                  max={1}
                  step={0.01}
                  value={combo.height}
                  onChange={(e) => updateCombo(combo.id, { height: Number(e.target.value) })}
                  aria-label="Pitch height"
                />
                <button
                  type="button"
                  className="combo-row__remove"
                  onClick={() => removeCombo(combo.id)}
                  aria-label="Remove combo"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <button type="button" className="controls__clear" onClick={addCombo}>
            Add combo
          </button>
        </section>

        <section className="tg-card tg-card--feed">
          <h2 className="tg-card__title">Live</h2>

          <div className="live-strip" aria-hidden="true">
            {liveNotes.length === 0 && <span className="live-strip__empty">Notes will appear here as messages arrive</span>}
            {liveNotes.map((note) => (
              <span key={note.id} className="live-strip__dot" style={{ background: note.color }} />
            ))}
          </div>

          <div className="tg-log">
            {log.length === 0 && <p className="tg-card__hint">No messages yet.</p>}
            {log.map((entry) => (
              <div className="tg-log__entry" key={entry.id}>
                <span className="tg-log__meta">{entry.fromLabel} · {entry.chatTitle}</span>
                <span className="tg-log__text">{entry.text}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
