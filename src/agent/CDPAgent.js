import { CDPBrowser } from '../browser/CDPBrowser.js';
import { LLMClient } from '../llm/LLMClient.js';
import { MarkdownPipeline } from '../parser/MarkdownPipeline.js';
export class CDPAgent {
    browser;
    llm;
    parser;
    maxSteps;
    constructor(config) {
        this.browser = new CDPBrowser();
        const llmConfig = {
            provider: config.provider,
            apiKey: config.apiKey || ''
        };
        if (config.model)
            llmConfig.model = config.model;
        if (config.baseUrl)
            llmConfig.baseUrl = config.baseUrl;
        this.llm = new LLMClient(llmConfig);
        this.parser = new MarkdownPipeline();
        this.maxSteps = config.maxSteps || 10;
    }
    async init() {
        await this.browser.init();
    }
    async execute(task) {
        const session = await this.browser.createPageSession();
        const actionsTaken = [];
        try {
            if (task.url) {
                await this.browser.navigate(session, task.url);
            }
            for (let step = 0; step < (task.maxSteps || this.maxSteps); step++) {
                console.log(`[Agent] Step ${step + 1}: Analyzing page...`);
                const html = await this.browser.getDOM(session);
                const markdown = this.parser.process(html, task.url || '');
                const decision = await this.decideNextAction(task.goal, markdown, actionsTaken);
                if (decision.done) {
                    console.log(`[Agent] Task complete: ${decision.reason}`);
                    return {
                        success: true,
                        data: decision.data || { markdown },
                        actionsTaken
                    };
                }
                if (!decision.action) {
                    throw new Error('AI failed to provide next action');
                }
                console.log(`[Agent] Taking action: ${decision.action.type}`);
                await this.browser.executeActions(session, [decision.action]);
                actionsTaken.push(decision.action);
                await new Promise(r => setTimeout(r, 1000));
            }
            return {
                success: false,
                error: 'Max steps reached',
                actionsTaken
            };
        }
        catch (error) {
            return {
                success: false,
                error: error.message,
                actionsTaken
            };
        }
        finally {
            await this.browser.closePageSession(session);
        }
    }
    async decideNextAction(goal, pageContent, previousActions) {
        const prompt = `You are a web automation agent. Your goal is: "${goal}"

Current page content (markdown):
${pageContent.slice(0, 8000)}

Previous actions taken:
${JSON.stringify(previousActions, null, 2)}

Based on the goal and current page state, decide what to do next.

Respond in JSON format:
{
  "done": boolean (true if goal is achieved),
  "reason": "explanation if done",
  "action": { "type": "click"|"type"|"scroll"|"wait"|"executeJS"|"screenshot", ... }
}

For action types:
- click: { "type": "click", "selector": "CSS selector" }
- type: { "type": "type", "selector": "CSS selector", "text": "text to type" }
- scroll: { "type": "scroll", "x": 0, "y": 500 }
- wait: { "type": "wait", "ms": 2000 }
- waitForSelector: { "type": "waitForSelector", "selector": "...", "timeout": 5000 }
- executeJS: { "type": "executeJS", "script": "JS code" }
- screenshot: { "type": "screenshot" }

If goal is achieved, set done=true and provide data in reason or return extracted data.
If you need to extract data, take a screenshot first then use executeJS to extract.
Only return ONE action at a time.`;
        const response = await this.llm.completePrompt(prompt, true);
        try {
            const result = JSON.parse(response);
            return result;
        }
        catch (e) {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            throw new Error('Failed to parse AI response');
        }
    }
    async close() {
        await this.browser.close();
    }
}
//# sourceMappingURL=CDPAgent.js.map