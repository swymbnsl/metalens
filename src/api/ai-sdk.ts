/**
 * Wrapper around the @openmetadata/ai-sdk for agent invocation and streaming.
 * Falls back to a direct fetch-based approach since the SDK may not be installed.
 */
export class AISdkClient {
  constructor(
    private host: string,
    private token: string
  ) {}

  /**
   * Stream a response from a named AI Studio agent.
   * Uses the OpenMetadata AI endpoint with SSE streaming.
   */
  async *streamResponse(
    agentName: string,
    prompt: string,
    conversationId?: string
  ): AsyncGenerator<string> {
    const body: Record<string, unknown> = {
      message: prompt,
      agentName,
    };
    if (conversationId) {
      body.conversationId = conversationId;
    }

    try {
      // Try to use @openmetadata/ai-sdk if available
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { AISdk } = require('@openmetadata/ai-sdk');
      const sdk = new AISdk({ host: this.host, token: this.token });
      for await (const event of sdk.agent(agentName).stream(prompt)) {
        if (event.type === 'content' && event.content) {
          yield event.content as string;
        }
      }
      return;
    } catch {
      // SDK not available — fall back to REST
    }

    // Fallback: use the OpenMetadata AI REST API directly
    const res = await fetch(`${this.host}/api/v1/apps/name/${encodeURIComponent(agentName)}/chat`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`AI SDK error ${res.status}: ${await res.text()}`);
    }

    if (!res.body) {
      const text = await res.text();
      yield text;
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') return;
          try {
            const parsed = JSON.parse(data) as { content?: string; type?: string };
            if (parsed.content) yield parsed.content;
          } catch {
            if (data) yield data;
          }
        }
      }
    }
  }

  /**
   * Non-streaming agent call.
   */
  async ask(agentName: string, prompt: string): Promise<string> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { AISdk } = require('@openmetadata/ai-sdk');
      const sdk = new AISdk({ host: this.host, token: this.token });
      const response = await sdk.agent(agentName).call(prompt) as { response: string };
      return response.response;
    } catch {
      // fallback
    }

    const res = await fetch(`${this.host}/api/v1/apps/name/${encodeURIComponent(agentName)}/chat`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: prompt, agentName }),
    });

    if (!res.ok) throw new Error(`AI error: ${res.status}`);
    const data = (await res.json()) as { response?: string; content?: string };
    return data.response ?? data.content ?? '';
  }
}
