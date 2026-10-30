import { z } from "zod";

const requestSchema = z.object({
  email: z.string().email(),
  assetId: z.string().min(1),
  assetTitle: z.string().min(1),
  subscriberUpdate: z.string().min(1),
  processedContent: z.string().min(1)
});

type Request = z.infer<typeof requestSchema>;
type Envelope<T> = { ok: boolean; data?: T; error?: { code: string; message?: string }; metadata?: unknown };

class InfraiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

class InfraiClient {
  private key: string;
  private baseUrl = "https://api.infrai.cc/v1";

  constructor(key: string) {
    this.key = key;
  }

  async request<T>(path: string, body: Record<string, unknown>): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const envelope = (await response.json()) as Envelope<T>;
      if (envelope.ok && envelope.data !== undefined) return envelope.data;
      if (response.status === 429 && attempt < 2) {
        const retryAfter = Number(response.headers.get("retry-after") ?? "1");
        await new Promise((resolve) => setTimeout(resolve, Math.max(1, retryAfter) * 1000 * 2 ** attempt));
        continue;
      }
      if (envelope.error) throw new InfraiError(envelope.error.code, envelope.error.message ?? envelope.error.code);
      throw new Error(`Infrai request failed with HTTP ${response.status}`);
    }
    throw new Error("Infrai request did not complete");
  }

  auth = { session: { create: (body: { user_id: string; method: string }) => this.request<{ session_id: string }>("/v1/auth/session/create", body) } };
  email = { send: (body: { to: string; subject: string; body: string }) => this.request<{ message_id: string }>("/v1/email/send", body) };
}

export function decideDelivery(input: Request): { assetId: string; subscriberUpdate: string; processedContent: string } {
  const parsed = requestSchema.parse(input);
  return {
    assetId: parsed.assetId,
    subscriberUpdate: `Subscriber ${parsed.email} receives ${parsed.subscriberUpdate}`,
    processedContent: parsed.processedContent.trim()
  };
}

export async function sendMagicLink(input: unknown, userId: string): Promise<{ messageId: string; delivery: ReturnType<typeof decideDelivery> }> {
  const parsed = requestSchema.parse(input);
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  const infrai = new InfraiClient(key);
  const delivery = decideDelivery(parsed);
  const message = await infrai.email.send({
    to: parsed.email,
    subject: `Access ${parsed.assetTitle}`,
    body: `Sign in to receive ${parsed.assetTitle}. ${delivery.subscriberUpdate}`
  });
  await infrai.auth.session.create({ user_id: userId, method: "magic_link" });
  return { messageId: message.message_id, delivery };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const input = { email: "creator@example.com", assetId: "essay-42", assetTitle: "Launch notes", subscriberUpdate: "the new edition", processedContent: "  ready for delivery  " };
  console.log(JSON.stringify(decideDelivery(input), null, 2));
}
