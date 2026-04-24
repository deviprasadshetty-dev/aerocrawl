import type { ExtractionSchema } from '../llm/LLMClient.js';
export declare class AIExtractor {
    private llmClient;
    private schemaGenerator;
    constructor(llmConfig: {
        provider: 'openai' | 'anthropic' | 'ollama';
        apiKey?: string;
        model?: string;
        baseUrl?: string;
    });
    extract(markdown: string, schema?: ExtractionSchema): Promise<{
        data: any;
        schema: ExtractionSchema;
        usage?: any;
    }>;
}
//# sourceMappingURL=AIExtractor.d.ts.map