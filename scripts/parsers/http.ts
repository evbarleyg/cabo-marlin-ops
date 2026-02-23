export interface HttpResponse {
  ok: boolean;
  status: number;
  text: string;
  fetchedAt: string;
  error?: string;
}

interface PoliteHttpClientOptions {
  userAgent: string;
  minDelayMs?: number;
  maxDelayMs?: number;
  fetchImpl?: typeof fetch;
  sleepImpl?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class PoliteHttpClient {
  private readonly userAgent: string;
  private readonly minDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly sleepImpl: (ms: number) => Promise<void>;
  private readonly cache = new Map<string, Promise<HttpResponse>>();
  private readonly domainQueues = new Map<string, Promise<void>>();

  constructor(options: PoliteHttpClientOptions) {
    this.userAgent = options.userAgent;
    this.minDelayMs = options.minDelayMs ?? 500;
    this.maxDelayMs = options.maxDelayMs ?? 1000;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleepImpl = options.sleepImpl ?? defaultSleep;
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
      const response = await this.fetchImpl(url, {
        headers: {
          "User-Agent": this.userAgent,
          Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
        },
      });

      const text = await response.text();
      return {
        ok: response.ok,
        status: response.status,
        text,
        fetchedAt,
        error: response.ok ? undefined : `HTTP ${response.status}`,
      };
    } catch (error) {
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
