export type LLMTask =
  | 'vision'
  | 'pfdbi'
  | 'base_draft'
  | 'document_analysis'
  | 'style_aggregation'
  | 'template_generation'
  | 'fewshot_generation'
  | 'style_quality'
  | 'style_adapter'
  | 'script_quality'
  | 'template_match'
  | 'style_select'
  | 'rewrite'
  | 'json_repair'
  | 'commercial_adapter'

export type ChatContentPart =
  { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | ChatContentPart[]
}

export interface ChatRequest {
  task: LLMTask
  messages: ChatMessage[]
  json?: boolean
  maxTokens?: number
  capability: 'text' | 'vision' | 'json' | 'reasoning'
}

export interface ChatUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  estimated: boolean
}

export interface ChatResponse {
  text: string
  model: string
  usage: ChatUsage
  durationMs: number
}

export interface LLMProvider {
  readonly name: string
  chat(request: ChatRequest, model: string): Promise<ChatResponse>
  listModels(): Promise<string[]>
}

export class ModelCapabilityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ModelCapabilityError'
  }
}
