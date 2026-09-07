# Lumen — paint a melody

An interactive music instrument with two tabs:

- **Camera** — your webcam feed fills the screen, you draw colored lines over
  it, and a scanner line sweeps left→right, playing a synthesized note each
  time it crosses a line.
- **Telegram** — connect a Telegram bot and play incoming chat messages live
  as a melody: configured symbol combos (e.g. `:)`, `❤`) play a specific
  note/color, and every other character falls back to a per-character note.

## Run it

Requires Node.js 18+.

```bash
npm install
npm run dev
```

Open the printed `localhost` URL in a modern browser (Chrome, Edge, Firefox,
or Safari) and allow camera access when prompted. `getUserMedia` requires a
secure context, so `localhost` works out of the box; to test on a phone over
your LAN you'll need HTTPS or a tool like `ngrok`.

## How it works

- **Draw** anywhere on screen with your mouse, finger, or stylus.
- **Pick a color** from the palette at the bottom — each color maps to a
  note (Red→C, Orange→D, Yellow→E, Green→F, Blue→G, Purple→A).
- **Where you draw vertically** sets the octave: higher on screen = higher
  pitch, lower on screen = lower pitch.
- The **scanner line** loops continuously across the screen. Every time it
  crosses one of your lines, it plays exactly one note for that crossing.
- Use **Play/Pause** to stop the scanner, **Clear** to erase your drawing,
  and the **Speed**/**Volume** sliders to taste.

Audio is generated live with the Web Audio API (oscillators + an envelope) —
no audio files involved. Browsers require a user gesture before audio can
play, so the first tap/click (drawing or pressing Play) unlocks sound.

## Telegram tab

1. Message **@BotFather** on Telegram, run `/newbot`, and copy the token it
   gives you (looks like `123456789:AA...`).
2. Send your new bot at least one message (or add it to a group) so Telegram
   has something to deliver.
3. In the app's **Telegram** tab, paste the token and hit **Connect**.
   - Leave **Chat ID** empty to react to messages from any chat the bot can
     see, or fill it in to only react to one conversation. (To find a chat
     ID, message the bot and check the `chat.id` field in a manual call to
     `https://api.telegram.org/bot<TOKEN>/getUpdates`.)
4. Add **symbol combos** — a pattern like `lol` or `❤`, a color/note, and a
   height slider for octave. Matched combos always take priority; any other
   character in the message falls back to a deterministic per-character note
   so the whole message still turns into a melody.

This works entirely from the browser via long polling (`getUpdates`) — no
backend needed, since Telegram's Bot API serves CORS headers that allow
direct browser requests.

**Security note:** the bot token lives only in that browser tab's memory
(never persisted to disk or sent anywhere but Telegram) — but it is visible
to anyone with access to that browser/device while connected. Only use a bot
token you control, and don't share it.

## Project structure

```
src/
  components/
    CameraBackground.tsx   — webcam video layer
    DrawingCanvas.tsx       — freehand drawing input + rendering
    Scanner.tsx              — animated playhead + collision loop
    ColorPalette.tsx         — color/note picker (also used for combo rows)
    Controls.tsx             — play/pause, clear, speed, volume
    CameraStage.tsx          — the "Camera" tab: wires the pieces above together
    TelegramStage.tsx        — the "Telegram" tab: bot connection, combos, live feed
    TabBar.tsx                — Camera / Telegram tab switcher
  audio/
    AudioEngine.ts           — Web Audio synth (oscillator + envelope + smear delay)
    noteMapping.ts            — color → note, Y/height → octave, char/combo → note
  drawing/
    Line.ts                   — line/point data types
    collisionDetection.ts    — scanner-sweep vs. line-segment intersection
  telegram/
    TelegramClient.ts        — long-polling Telegram Bot API client
  hooks/
    useViewportSize.ts        — shared window-size hook
  App.tsx                     — header + tab switching
```

Lines are stored as geometry (arrays of `{x, y}` points), not pixels, so
collision detection works against the actual drawn paths rather than reading
back canvas pixel data.
