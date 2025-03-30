import { Compiler, Result } from "../html/engine";
import readline from "readline";
import { existsSync, readFileSync } from "fs";

export type line = string[];

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
            // Init page data
            let pageNum = 0;

            // Init screen
            this.clearScreen();
            process.title = "smolsurf";

            // Waiting for URL
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

            // Site load result
            let result: Result, pages: string[][] = [];

            try {
                result = await this.load(this.url);

                // Clear the search bar
                this.clearScreen();

                // Set console's title to site's title
                if (result.options.title !== "") {
                    process.title = "smolsurf: " + result.options.title;
                } else {
                    process.title = "smolsurf: " + this.url;
                }

                // Divide the site's content into multiple pages
                pages = this.getPages(result.textStream);

                // Render the first page
                this.render(pages, pageNum);
            } catch (e) {
                this.url = "";
                console.log("Unexpected error.");
                continue;
            }

            this.url = "";

            // Recalculate pages size when console resize
            process.stdout.on("resize", () => {
                pages = this.getPages(result.textStream);

                // Smaller windows can have more pages, so a page might not exist in bigger windows
                if (pageNum >= pages.length) { pageNum = pages.length-1; }

                this.clearScreen();
                this.render(pages, pageNum);
            });

            // Pause and wait for key presses
            await new Promise<void>((resolve) => {
                process.stdin.setRawMode(true);
                process.stdin.resume();

                const keyEventListener = (data: Buffer) => {
                    const key = data.toString();

                    // Exit
                    if (key === "\x03") { // Ctrl + C
                        process.stdin.removeListener("data", keyEventListener);
                        process.stdin.setRawMode(false);
                        process.stdin.pause();
                        process.exit(0);
                    }
                    // Exit to menu
                    else if (key === "\r" || key === "\n") {
                        process.stdin.removeListener("data", keyEventListener);
                        process.stdin.setRawMode(false);
                        process.stdin.pause();
                        process.stdout.removeAllListeners("resize");
                        resolve();
                    }
                    // Scroll up/move cursor up
                    else if (key === "\x1B[A" && pageNum > 0) {
                        pageNum--;
                        this.clearScreen();
                        this.render(pages, pageNum);
                    }
                    // Scroll down/move cursor down
                    else if (key === "\x1B[B" && pageNum < pages.length - 1) {
                        pageNum++;
                        this.clearScreen();
                        this.render(pages, pageNum);
                    }
                    // Show links of the previous site
                    else if (key === "\t") {
                        this.clearScreen();
                        pages = this.getPages(result.options.attachments);
                        pageNum = 0;
                        this.render(pages, pageNum);
                    }
                }

                process.stdin.on("data", keyEventListener);
            });
        }
    }

    getPages(text: string) {
        // Get console size
        const width = process.stdout.columns || 80;
        const height = (process.stdout.rows || 24) - 3; // 3 lines for guide and cursor

        const pages: string[][] = [[]];
        // The map is used to convert a line string into an array of characters, where ANSI escape codes
        // (which are really strings made up of multiple characters) are counted as singular characters
        const originalLines: line[] = text.split("\n").map(line => this.strToLine(line));

        for (const line of originalLines) {
            if (line.length === 0) { // Empty lines
                if (pages[pages.length - 1].length >= height) {
                    pages.push([]);
                }

                pages[pages.length - 1].push("");
            } else {
                for (let i = 0; i < line.length; i += width) {
                    if (pages[pages.length - 1].length >= height) {
                        pages.push([]);
                    }

                    // Since ANSI escape codes are not visible when displayed, we gather more real chars to fit into that line
                    let currentLine = line.slice(i, i + width);
                    let trueLength = currentLine.length;
                    let displayLength = this.getDisplayLength(currentLine);
                    let needToFulfill = trueLength - displayLength;
                    let extraChar = 0;
                    
                    for (let k = i + width; k < line.length; k++) {
                        if (needToFulfill === 0) break;

                        if (!this.isEscape(line[k])) {
                            needToFulfill--;
                        }

                        extraChar++;
                    }

                    pages[pages.length - 1].push(line.slice(i, i + width + extraChar).join(""));

                    i += extraChar;
                }
            }
        }

        while (pages[pages.length - 1].length < height) {
            pages[pages.length - 1].push("");
        }

        return pages;
    }

    render(pages: string[][], pageNum: number) {
        console.log(
            (pages[pageNum] || []).join("\n") +
            "\x1b[0m\n\n[Enter] to exit, [Arrow Keys] to scroll, [Tab] to show links in this site"
        );
    }

    clearScreen() {
        process.stdout.write("\x1b[H\x1b[2J\x1b[3J\x1bc"); // Resets terminal
    }

    // A line is just an array of characters, but ANSI escape codes are counted as characters
    strToLine(str: string) {
        return str.match(/\x1b\[[0-9;]*m|./g) || [];
    }

    // ANSI escape codes are not visible, so we do not count them in a line in display
    getDisplayLength(str: line) {
        let length = 0;

        for (const char of str) {
            length += char.replace(/\x1b\[[0-9;]*m/g, "").length;
        }

        return length;
    }

    // Check if character is an ANSI escape code
    isEscape(char: string) {
        return char.replace(/\x1b\[[0-9;]*m/g, "").length === 0;
    }

    // Get the content of a site
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
                finalUrl = "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(url);
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
