export interface LLMConfig {
    provider: 'openai' | 'anthropic' | 'ollama' | 'openrouter';
    apiKey?: string;
    model?: string;
    baseUrl?: string;
    temperature?: number;
    maxTokens?: number;
}
export interface LLMMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}
export interface LLMResponse {
    content: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
    };
}
export interface SchemaProperty {
    type: string;
    description?: string;
    items?: SchemaProperty;
    properties?: Record<string, SchemaProperty>;
    required?: string[];
}
export interface ExtractionSchema {
    name: string;
    description?: string;
    schema: {
        type: 'object';
        properties: Record<string, SchemaProperty>;
        required?: string[];
    };
}
export type LLMProvider = 'openai' | 'anthropic' | 'ollama' | 'openrouter';
export declare class LLMClient {
    private config;
    constructor(config: LLMConfig);
    complete(messages: LLMMessage[]): Promise<LLMResponse>;
    completePrompt(prompt: string, jsonMode?: boolean): Promise<string>;
    private callOpenAI;
    private callAnthropic;
    private callOllama;
    private callOpenRouter;
}
//# sourceMappingURL=LLMClient.d.ts.map