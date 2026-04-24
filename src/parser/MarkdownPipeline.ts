import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import TurndownService from 'turndown';

export class MarkdownPipeline {
    private turndownService: TurndownService;

    constructor() {
        this.turndownService = new TurndownService({
            headingStyle: 'atx',
            codeBlockStyle: 'fenced'
        });

        // Add custom rules for better semantic output
        this.turndownService.remove(['script', 'style', 'noscript', 'nav', 'footer', 'iframe']);
    }

    public process(html: string, url: string): string {
        // Step 1: Parse DOM
        const doc = new JSDOM(html, { url });

        // Step 2: Extract main content using Mozilla Readability
        const reader = new Readability(doc.window.document);
        const article = reader.parse();

        // Step 3: Convert to Markdown
        // If readability failed, fallback to body
        const contentToConvert = article?.content ? article.content : doc.window.document.body.innerHTML;
        
        let markdown = this.turndownService.turndown(contentToConvert);

        // Prepend Title if available
        if (article && article.title) {
            markdown = `# ${article.title}\n\n${markdown}`;
        }

        return markdown;
    }
}
