import { execFile } from "node:child_process";
import { promisify } from "node:util";

export interface HttpResponse {
  ok: boolean;
  status: number;
  text: string;
  fetchedAt: string;
  error?: string;
}

type FallbackGet = (url: string, userAgent: string, timeoutMs: number) => Promise<HttpResponse | null>;

interface PoliteHttpClientOptions {
  userAgent: string;
  minDelayMs?: number;
  maxDelayMs?: number;
  requestTimeoutMs?: number;
  fetchImpl?: typeof fetch;
  sleepImpl?: (ms: number) => Promise<void>;
  fallbackGet?: FallbackGet;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const execFileAsync = promisify(execFile);

async function defaultFallbackGet(url: string, userAgent: string, timeoutMs: number): Promise<HttpResponse | null> {
  const fetchedAt = new Date().toISOString();
  const timeoutSeconds = Math.max(5, Math.ceil(timeoutMs / 1000));

  try {
    const { stdout } = await execFileAsync(
      "curl",
      [
        "-L",
        "--silent",
        "--show-error",
        "--fail",
        "--max-time",
        String(timeoutSeconds),
        "--connect-timeout",
        String(Math.min(8, timeoutSeconds)),
        "-A",
        userAgent,
        "-H",
        "Accept: text/html,application/json;q=0.9,*/*;q=0.8",
        url,
      ],
      {
        maxBuffer: 10 * 1024 * 1024,
      },
    );
    return {
      ok: true,
      status: 200,
      text: stdout,
      fetchedAt,
    };
  } catch {
    return null;
  }
}

export class PoliteHttpClient {
  private readonly userAgent: string;
  private readonly minDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly requestTimeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly sleepImpl: (ms: number) => Promise<void>;
  private readonly fallbackGet: FallbackGet;
  private readonly cache = new Map<string, Promise<HttpResponse>>();
  private readonly domainQueues = new Map<string, Promise<void>>();

  constructor(options: PoliteHttpClientOptions) {
    this.userAgent = options.userAgent;
    this.minDelayMs = options.minDelayMs ?? 500;
    this.maxDelayMs = options.maxDelayMs ?? 1000;
    this.requestTimeoutMs = options.requestTimeoutMs ?? 15000;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleepImpl = options.sleepImpl ?? defaultSleep;
    this.fallbackGet = options.fallbackGet ?? defaultFallbackGet;
  }

  async get(url: string): Promise<HttpResponse> {
    const cached = this.cache.get(url);
    if (cached) return cached;

    const domain = new URL(url).hostname;
    const previous = this.domainQueues.get(domain) ?? Promise.resolve();

    const requestPromise = previous
      .catch(() => undefined)
      .then(async () => {
        const delay = this.randomDelay();
        await this.sleepImpl(delay);
        return this.fetchUrl(url);
      });

    this.domainQueues.set(
      domain,
      requestPromise
        .then(() => undefined)
        .catch(() => undefined),
    );

    this.cache.set(url, requestPromise);
    return requestPromise;
  }

  private randomDelay(): number {
    if (this.minDelayMs >= this.maxDelayMs) return this.minDelayMs;
    return Math.floor(Math.random() * (this.maxDelayMs - this.minDelayMs + 1)) + this.minDelayMs;
  }

  private async fetchUrl(url: string): Promise<HttpResponse> {
    const fetchedAt = new Date().toISOString();

    try {
      const controller = typeof AbortController !== "undefined" ? new AbortController() : undefined;
      let timeoutId: ReturnType<typeof setTimeout> | undefined;

      const timeoutError = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          controller?.abort();
          reject(new Error(`Timeout after ${this.requestTimeoutMs}ms`));
        }, this.requestTimeoutMs);
      });

      const response = (await Promise.race([
        this.fetchImpl(url, {
          headers: {
            "User-Agent": this.userAgent,
            Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
          },
          ...(controller ? { signal: controller.signal } : {}),
        }),
        timeoutError,
      ])) as Response;

      if (timeoutId) clearTimeout(timeoutId);

      const text = await response.text();
      return {
        ok: response.ok,
        status: response.status,
        text,
        fetchedAt,
        error: response.ok ? undefined : `HTTP ${response.status}`,
      };
    } catch (error) {
      const fallback = await this.fallbackGet(url, this.userAgent, this.requestTimeoutMs);
      if (fallback) {
        return fallback;
      }

      const message = error instanceof Error ? error.message : "Unknown fetch error";
      return {
        ok: false,
        status: 0,
        text: "",
        fetchedAt,
        error: message,
      };
    }
  }
}
