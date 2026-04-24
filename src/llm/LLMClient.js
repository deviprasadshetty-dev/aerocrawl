export class LLMClient {
    config;
    constructor(config) {
        this.config = {
            temperature: 0.1,
            maxTokens: 4096,
            ...config
        };
    }
    async complete(messages) {
        switch (this.config.provider) {
            case 'openai':
                return this.callOpenAI(messages);
            case 'anthropic':
                return this.callAnthropic(messages);
            case 'ollama':
                return this.callOllama(messages);
            case 'openrouter':
                return this.callOpenRouter(messages);
            default:
                throw new Error(`Unsupported provider: ${this.config.provider}`);
        }
    }
    async completePrompt(prompt, jsonMode = false) {
        const messages = [
            { role: 'user', content: prompt }
        ];
        const response = await this.complete(messages);
        if (jsonMode) {
            // Try to extract JSON from response
            const content = response.content;
            try {
                JSON.parse(content);
                return content;
            }
            catch {
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                if (jsonMatch)
                    return jsonMatch[0];
                throw new Error('Failed to get valid JSON from AI response');
            }
        }
        return response.content;
    }
    async callOpenAI(messages) {
        const apiKey = this.config.apiKey || process.env.OPENAI_API_KEY;
        if (!apiKey)
            throw new Error('OpenAI API key required');
        const model = this.config.model || 'gpt-4o-mini';
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model,
                messages,
                temperature: this.config.temperature,
                max_tokens: this.config.maxTokens
            })
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`OpenAI API error: ${response.status} - ${error}`);
        }
        const data = await response.json();
        return {
            content: data.choices[0].message.content,
            usage: {
                promptTokens: data.usage.prompt_tokens,
                completionTokens: data.usage.completion_tokens
            }
        };
    }
    async callAnthropic(messages) {
        const apiKey = this.config.apiKey || process.env.ANTHROPIC_API_KEY;
        if (!apiKey)
            throw new Error('Anthropic API key required');
        const model = this.config.model || 'claude-3-5-haiku-20241022';
        const systemMessage = messages.find(m => m.role === 'system');
        const userMessages = messages.filter(m => m.role !== 'system');
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model,
                system: systemMessage?.content || '',
                messages: userMessages,
                temperature: this.config.temperature,
                max_tokens: this.config.maxTokens
            })
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Anthropic API error: ${response.status} - ${error}`);
        }
        const data = await response.json();
        return {
            content: data.content[0].text,
            usage: {
                promptTokens: data.usage.input_tokens,
                completionTokens: data.usage.output_tokens
            }
        };
    }
    async callOllama(messages) {
        const baseUrl = this.config.baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
        const model = this.config.model || 'llama3.2';
        const response = await fetch(`${baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                messages,
                stream: false,
                options: {
                    temperature: this.config.temperature,
                    num_predict: this.config.maxTokens
                }
            })
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Ollama API error: ${response.status} - ${error}`);
        }
        const data = await response.json();
        return {
            content: data.message.content
        };
    }
    async callOpenRouter(messages) {
        const apiKey = this.config.apiKey || process.env.OPENROUTER_API_KEY;
        if (!apiKey)
            throw new Error('OpenRouter API key required');
        const model = this.config.model || process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3-super-120b-a12b:free';
        const baseUrl = this.config.baseUrl || 'https://openrouter.ai/api/v1';
        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'https://aerocrawl.ai',
                'X-Title': 'AeroCrawl'
            },
            body: JSON.stringify({
                model,
                messages,
                temperature: this.config.temperature,
                max_tokens: this.config.maxTokens
            })
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
        }
        const data = await response.json();
        const result = {
            content: data.choices[0].message.content
        };
        if (data.usage) {
            result.usage = {
                promptTokens: data.usage.prompt_tokens,
                completionTokens: data.usage.completion_tokens
            };
        }
        return result;
    }
}
//# sourceMappingURL=LLMClient.js.map