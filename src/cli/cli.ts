import { Compiler, Result } from "../html/engine";
import readline from "readline";
import { execSync } from "child_process";
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
        execSync("@echo off", { stdio: "inherit" });
        execSync("chcp 65001 >nul", { stdio: "inherit" });

        for (;;) {
            console.clear();
            execSync("cls", { stdio: "inherit" });
            execSync("title smolsurf");

            if (!this.url) {
                this.url = await new Promise((resolve, reject) => {
                    const input = readline.createInterface({
                        input: process.stdin,
                        output: process.stdout,
                        terminal: true
                    });

                    input.question("Enter URL: ", async (url) => {
                        resolve(url);
                        input.close();
                    })
                });
            }

            try {
                const result = await this.load(this.url);

                if (result.options.title !== "") { 
                    execSync(`title smolsurf: ${result.options.title}`);
                } else {
                    execSync(`title smolsurf: ${this.url}`);
                }

                console.log(result.textStream);
            } catch (e) {
                console.log("Unexpected error.")
            }
            
            this.url = "";

            execSync("pause", { stdio: "inherit" });
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
        // Handle html files served through https/http
        else {
            const offset = urlTrimStart.startsWith("https://") || urlTrimStart.startsWith("http://") ? "" : "https://";
            const response = await fetch(offset + url);
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
