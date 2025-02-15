"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLI = void 0;
const engine_1 = require("../html/engine");
const readline_1 = __importDefault(require("readline"));
const fs_1 = require("fs");
class CLI {
    cargs;
    url;
    constructor(options) {
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
                    const input = readline_1.default.createInterface({
                        input: process.stdin,
                        output: process.stdout,
                        terminal: true
                    });
                    input.question("Enter URL: ", async (url) => {
                        resolve(url);
                        input.close();
                    });
                });
            }
            try {
                const result = await this.load(this.url);
                if (result.options.title !== "") {
                    process.title = "smolsurf: " + result.options.title;
                }
                else {
                    process.title = "smolsurf: " + this.url;
                }
                console.log(result.textStream);
            }
            catch (e) {
                console.log("Unexpected error.");
            }
            this.url = "";
            // Pause and wait for key presses to exit site and search another
            await new Promise((resolve) => {
                const input = readline_1.default.createInterface({
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
    async load(url) {
        let code = "";
        let urlTrimStart = url.trimStart();
        // Handle local html files
        if (urlTrimStart.startsWith("file:///")) {
            code = (0, fs_1.readFileSync)(urlTrimStart.slice(8)).toString("utf8");
        }
        else if ((0, fs_1.existsSync)(url)) {
            code = (0, fs_1.readFileSync)(url).toString("utf8");
        }
        // Handle html files served through https/http
        else {
            const offset = urlTrimStart.startsWith("https://") || urlTrimStart.startsWith("http://") ? "" : "https://";
            const response = await fetch(offset + url);
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("text/html")) {
                code = await response.text();
            }
            else {
                throw new Error("Unsupported content type.");
            }
        }
        const compiler = new engine_1.Compiler();
        const result = compiler.interpret(compiler.parse(compiler.tokenize(code)));
        return result;
    }
}
exports.CLI = CLI;
