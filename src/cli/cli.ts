import { Compiler, Result } from "../html/engine";
import readline from "readline";
import { existsSync, readFileSync } from "fs";

export interface CLIOptions {
    cargs: string[];
}

export class CLI {
    public cargs: string[];
    public url: string;

    constructor(options: CLIOptions) {
        this.cargs = options.cargs || [];
        this.url = this.cargs[2] || "";
    }

    async listen() {
        for (;;) {
            console.log("\x1b[H\x1b[2J\x1b[3J"); // Clears screen and scrollback
            process.stdout.write("\x1bc"); // Resets terminal
            process.title = "smolsurf";

            if (!this.url) {
                this.url = await new Promise((resolve) => {
                    const input = readline.createInterface({
                        input: process.stdin,
                        output: process.stdout,
                        terminal: true
                    });

                    input.question("Search: ", async (url) => {
                        resolve(url);
                        input.close();
                    })
                });
            }

            try {
                const result = await this.load(this.url);

                if (result.options.title !== "") { 
                    process.title = "smolsurf: " + result.options.title;
                } else {
                    process.title = "smolsurf: " + this.url;
                }

                console.log(result.textStream);
            } catch (e) {
                console.log("Unexpected error.")
            }
            
            this.url = "";

            // Pause and wait for key presses to exit site and search another
            await new Promise<void>((resolve) => {
                const input = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout
                });
        
                console.log("\nPress any key to continue...");
        
                process.stdin.setRawMode(true);
                process.stdin.resume();
                process.stdin.once("data", () => {
                    process.stdin.setRawMode(false);
                    input.close();
                    resolve();
                });
            });
        }
    }

    async load(url: string): Promise<Result> {
        let code = "";

        let urlTrimStart = url.trimStart();

        // Handle local html files
        if (urlTrimStart.startsWith("file:///")) {
            code = readFileSync(urlTrimStart.slice(8)).toString("utf8");
        } else if (existsSync(url)) {
            code = readFileSync(url).toString("utf8"); 
        }
        // Handle html files served through https/http or pass to a search engine
        else {
            const offset = urlTrimStart.startsWith("https://") || urlTrimStart.startsWith("http://") ? "" : "https://";
            
            let finalUrl = offset + url;

            try {
                new URL(finalUrl);

                if (!finalUrl.includes(".")) throw new Error();
            } catch (e) {
                finalUrl = "https://www.mojeek.com/search?q=" + encodeURIComponent(url);
            }

            const response = await fetch(finalUrl);
            const contentType = response.headers.get("content-type");

            if (contentType && contentType.includes("text/html")) {
                code = await response.text();
            } else {
                throw new Error("Unsupported content type.");
            }
        }

        const compiler = new Compiler();
        const result = compiler.interpret(compiler.parse(compiler.tokenize(code)));

        return result;
    }
}
