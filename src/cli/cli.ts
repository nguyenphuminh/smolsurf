import { Compiler, Result } from "../html/engine";
import readline from "readline";
import { execSync } from "child_process";

export class CLI {
    async listen() {
        execSync("@echo off", { stdio: "inherit" });
        execSync("chcp 65001", { stdio: "inherit" });

        for (;;) {
            console.clear();
            execSync("title smolsurf");

            try {
                const input = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout,
                    terminal: true
                });
        
                await new Promise<void>((resolve, reject) => {
                    input.question("Enter URL: ", async (url) => {
                        try {
                            const result = await this.load(url);

                            if (result.options.title !== "") { 
                                execSync(`title smolsurf: ${result.options.title}`);
                            } else {
                                execSync(`title smolsurf: ${url}`);
                            }

                            console.log(result.textStream);
                            
                            resolve();
                        } catch (e) {
                            // console.log(e);

                            reject(e);
                        }

                        input.close();
                    })
                });
            } catch (e) {
                console.log("Unexpected error.")
            }

            execSync("pause", { stdio: "inherit" });
        }
    }

    async load(url: string): Promise<Result> {
        const response = await fetch(url);
        const contentType = response.headers.get("content-type");

        if (contentType && contentType.includes("text/html")) {
            const code = await response.text();

            const compiler = new Compiler();
            const result = compiler.interpret(compiler.parse(compiler.tokenize(code)));

            return result;
        } else {
            throw new Error("Unsupported content type.");
        }
    }
}
