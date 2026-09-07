export type TelegramStatus = "idle" | "connecting" | "connected" | "error";

export type TelegramMessage = {
  chatId: string;
  chatTitle: string;
  text: string;
  fromLabel: string;
};

type Listeners = {
  onStatus: (status: TelegramStatus, detail?: string) => void;
  onMessage: (message: TelegramMessage) => void;
};

const API_ROOT = "https://api.telegram.org";
const LONG_POLL_TIMEOUT_S = 25;
const RETRY_DELAY_MS = 3000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Talks directly to the Telegram Bot API from the browser using long
 * polling (`getUpdates`) — no server component needed. Telegram's Bot API
 * serves permissive CORS headers, which is what makes this possible.
 *
 * Security note: the bot token lives in this tab's memory only (never
 * persisted) but is visible to anyone with access to this browser/device
 * while connected. Only use a bot you control, never a token shared with
 * others.
 */
export class TelegramClient {
  private token: string | null = null;
  private chatFilter: string | null = null;
  private offset = 0;
  private connected = false;
  private controller: AbortController | null = null;
  private listeners: Listeners | null = null;

  async connect(token: string, chatFilter: string, listeners: Listeners): Promise<void> {
    this.token = token.trim();
    this.chatFilter = chatFilter.trim() || null;
    this.listeners = listeners;
    this.connected = true;
    this.offset = 0;

    listeners.onStatus("connecting");

    try {
      const me = await this.call("getMe");
      if (!me.ok) throw new Error(me.description || "Invalid bot token");
      listeners.onStatus("connected", me.result?.username ? `@${me.result.username}` : undefined);
    } catch (err) {
      this.connected = false;
      listeners.onStatus("error", errorMessage(err));
      return;
    }

    void this.pollLoop();
  }

  disconnect(): void {
    this.connected = false;
    this.controller?.abort();
    this.controller = null;
    this.listeners?.onStatus("idle");
  }

  get isConnected(): boolean {
    return this.connected;
  }

  private async call(method: string, params: Record<string, string | number> = {}): Promise<any> {
    if (!this.token) throw new Error("Missing bot token");
    const query = new URLSearchParams(params as Record<string, string>).toString();
    this.controller = new AbortController();
    const res = await fetch(`${API_ROOT}/bot${this.token}/${method}${query ? `?${query}` : ""}`, {
      signal: this.controller.signal,
    });
    if (res.status === 401 || res.status === 404) {
      throw new Error("Telegram rejected this bot token");
    }
    return res.json();
  }

  private async pollLoop(): Promise<void> {
    while (this.connected) {
      try {
        const data = await this.call("getUpdates", {
          timeout: LONG_POLL_TIMEOUT_S,
          offset: this.offset,
        });

        if (!data.ok) {
          throw new Error(data.description || "Telegram API error");
        }

        for (const update of data.result ?? []) {
          this.offset = update.update_id + 1;
          const msg = update.message ?? update.channel_post ?? update.edited_message;
          if (!msg?.text) continue;

          const chatId = String(msg.chat.id);
          if (this.chatFilter && chatId !== this.chatFilter) continue;

          this.listeners?.onMessage({
            chatId,
            chatTitle: msg.chat.title || msg.chat.username || chatId,
            text: msg.text as string,
            fromLabel: msg.from?.first_name || msg.from?.username || "unknown",
          });
        }

        if (this.connected) this.listeners?.onStatus("connected");
      } catch (err) {
        if (!this.connected) return; // intentional disconnect (AbortError)
        this.listeners?.onStatus("error", errorMessage(err));
        await sleep(RETRY_DELAY_MS);
      }
    }
  }
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
