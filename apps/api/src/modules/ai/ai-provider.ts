import type { Config } from '../../config/env';

/*
 * The AI provider interface. Services never call a provider: they call AI tasks, and tasks go
 * through the AI runner (ai-runner.ts), which validates the output, retries once and records
 * an AiRun for every call. Only the Anthropic provider imports the Anthropic SDK.
 */

/** How much reasoning the model may spend (Claude's output_config.effort). */
export type AiEffort = Config['ai']['effort'];

/** standard, or fast: Claude's fast mode, quicker answers at a higher price. */
export type AiSpeed = 'standard' | 'fast';

/** A photo ready for the AI: resized and re-encoded (see ai-images.ts). */
export interface AiImage {
  mediaType: 'image/jpeg' | 'image/webp';
  data: Buffer;
  width: number;
  height: number;
}

/** The tool the model must call with its answer. */
export interface AiTool {
  name: string;
  description: string;
  /** JSON Schema of the answer, already valid for strict tool use (see strict-json-schema.ts). */
  inputSchema: Record<string, unknown>;
}

export interface AiRequest {
  /** Prompt name without version, e.g. snap-analysis.study (MockAiProvider picks its fixture by it). */
  promptName: string;
  /** Images, sent before the text. */
  images: readonly AiImage[];
  /** The rendered prompt. */
  text: string;
  tool: AiTool;
  effort: AiEffort;
  speed: AiSpeed;
}

/** Why the model stopped. "other" covers stop reasons the pipeline does not handle on purpose. */
export type AiStopReason = 'end_turn' | 'tool_use' | 'max_tokens' | 'refusal' | 'other';

export interface AiReply {
  stopReason: AiStopReason;
  /** The input of the first call to the requested tool, or null when the model did not call it. */
  toolCall: { input: unknown } | null;
  /** Text the model wrote outside the tool call, if any. */
  text: string;
  usage: { inputTokens: number; outputTokens: number };
}

/**
 * One request and, at most, one correction. The conversation keeps the provider's own message
 * history, so the correction resends the reply exactly as it was received.
 */
export interface AiConversation {
  send(): Promise<AiReply>;
  /**
   * Answers the last reply: a failed tool result with the feedback when the model called the
   * tool, or a new user message with the feedback when it did not.
   */
  sendCorrection(feedback: string): Promise<AiReply>;
}

export interface AiProvider {
  /** Stored in AiRun.provider: anthropic or mock. */
  readonly name: string;
  /** Stored in AiRun.model (AI_MODEL). */
  readonly model: string;
  startConversation(request: AiRequest): AiConversation;
}

export type AiProviderErrorCode =
  | 'AI_TIMEOUT'
  | 'AI_RATE_LIMITED'
  | 'AI_UNAVAILABLE'
  | 'AI_AUTHENTICATION_FAILED'
  | 'AI_REQUEST_REJECTED'
  | 'AI_PROVIDER_ERROR';

/** A call that failed before the model answered (network, timeout, rejected request…). */
export class AiProviderError extends Error {
  readonly code: AiProviderErrorCode;

  constructor(code: AiProviderErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'AiProviderError';
    this.code = code;
  }
}
