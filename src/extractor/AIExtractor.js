import { LLMClient } from '../llm/LLMClient.js';
import { AutoSchemaGenerator } from '../llm/AutoSchemaGenerator.js';
export class AIExtractor {
    llmClient;
    schemaGenerator;
    constructor(llmConfig) {
        this.llmClient = new LLMClient(llmConfig);
        this.schemaGenerator = new AutoSchemaGenerator(this.llmClient);
    }
    async extract(markdown, schema) {
        let finalSchema = schema;
        if (!finalSchema) {
            finalSchema = await this.schemaGenerator.generate(markdown);
        }
        const truncatedMarkdown = markdown.slice(0, 15000);
        const messages = [
            {
                role: 'system',
                content: `You are a precise data extraction expert. Extract structured data from markdown content according to the provided JSON schema.

Rules:
1. Extract ONLY data that exists in the content
2. Use null for missing optional fields
3. Follow the schema types exactly
4. Respond with ONLY valid JSON matching the schema, no other text`
            },
            {
                role: 'user',
                content: `Extract data according to this schema:
${JSON.stringify(finalSchema, null, 2)}

Content to extract from:
${truncatedMarkdown}`
            }
        ];
        const response = await this.llmClient.complete(messages);
        try {
            const extractedData = JSON.parse(response.content);
            return {
                data: extractedData,
                schema: finalSchema,
                usage: response.usage
            };
        }
        catch (error) {
            throw new Error(`Failed to parse extracted JSON: ${error}`);
        }
    }
}
//# sourceMappingURL=AIExtractor.js.map