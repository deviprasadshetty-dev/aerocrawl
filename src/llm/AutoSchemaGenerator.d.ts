import { LLMClient } from './LLMClient.js';
import type { ExtractionSchema } from './LLMClient.js';
export declare class AutoSchemaGenerator {
    private llmClient;
    constructor(llmClient: LLMClient);
    generate(markdown: string, name?: string): Promise<ExtractionSchema>;
}
//# sourceMappingURL=AutoSchemaGenerator.d.ts.map