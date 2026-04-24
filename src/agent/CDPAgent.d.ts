import { type CdpAction } from '../browser/CDPBrowser.js';
import { type LLMConfig } from '../llm/LLMClient.js';
export interface AgentConfig {
    provider: LLMConfig['provider'];
    apiKey?: string;
    model?: string;
    baseUrl?: string;
    maxSteps?: number;
}
export interface AgentTask {
    goal: string;
    url?: string;
    maxSteps?: number;
}
export interface AgentResult {
    success: boolean;
    data?: any;
    actionsTaken: CdpAction[];
    error?: string;
}
export declare class CDPAgent {
    private browser;
    private llm;
    private parser;
    private maxSteps;
    constructor(config: AgentConfig);
    init(): Promise<void>;
    execute(task: AgentTask): Promise<AgentResult>;
    private decideNextAction;
    close(): Promise<void>;
}
//# sourceMappingURL=CDPAgent.d.ts.map