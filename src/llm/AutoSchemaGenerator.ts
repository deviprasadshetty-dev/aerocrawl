import { LLMClient } from './LLMClient.js';
import type { LLMMessage, ExtractionSchema } from './LLMClient.js';

export class AutoSchemaGenerator {
    private llmClient: LLMClient;

    constructor(llmClient: LLMClient) {
        this.llmClient = llmClient;
    }

    async generate(markdown: string, name?: string): Promise<ExtractionSchema> {
        const truncatedMarkdown = markdown.slice(0, 8000);

        const messages: LLMMessage[] = [
            {
                role: 'system',
                content: `You are a JSON schema generation expert. Analyze the provided markdown content and generate a JSON schema that captures the key structured data that can be extracted from it.

Rules:
1. Generate a schema with 3-8 relevant properties based on the content
2. Use appropriate JSON Schema types (string, number, boolean, array, object)
3. Add clear descriptions for each property
4. Mark the most important fields as required
5. Respond with ONLY valid JSON in this exact format:
{
  "name": "descriptive_schema_name",
  "description": "What this schema extracts",
  "schema": {
    "type": "object",
    "properties": {
      "propertyName": {
        "type": "string|number|boolean|array|object",
        "description": "What this property represents"
      }
    },
    "required": ["propertyName"]
  }
}`
            },
            {
                role: 'user',
                content: `Generate a JSON extraction schema for this markdown content:\n\n${truncatedMarkdown}`
            }
        ];

        const response = await this.llmClient.complete(messages);

        try {
            const schema = JSON.parse(response.content) as ExtractionSchema;
            if (name) schema.name = name;
            return schema;
        } catch (error) {
            throw new Error(`Failed to parse auto-generated schema: ${error}`);
        }
    }
}
