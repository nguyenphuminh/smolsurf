import { decodeHtmlEntities } from "./encoding";

// export const IDEN_CHARACTERS = "0123456789abcdefghijklmnopqrstuvwxyz-_.:%";
export const NUMERALS = "0123456789";

export interface Token {
    type: "punc" | "string" | "text" | "identifier";
    value: string;
    line: number;
    col: number;
}

export interface TagBody {
    name: string;
    attributes: Record<string, string | boolean>;
    children: (string | TagBody)[];
    stage: "name" | "attr" | "body";
    strictlySingular?: boolean;
}

export interface Result {
    textStream: string;
    options: Record<string, any>;
}

export interface Scope {
    tag: string;
    options: any;
}

export type AST = (string | TagBody)[];


export class Compiler {
    tokenize(input: string): Token[] {
        // Blud I'm too lazy to implement proper SGML for now
        input = input.replaceAll("\r", "").replace(/<!DOCTYPE\s+html.*?>/gi, "");
        // Blud I'm too lazy to parse JS and CSS for now
        input = input.replace(/<script[^>]*?>[\s\S]*?<\/script\s*>/gi, "")
                     .replace(/<style[^>]*?>[\s\S]*?<\/style\s*>/gi, "");

        const tokens: Token[] = [];

        // Stores identifier or string values
        let temp = "";

        // A flag used to record string tokens
        let isString = false;
        // A flag used to record comments
        let isComment = false;
        // A flag used to record text
        let isText = false;
        // Variable to record current line num, used for errors
        let currentLine = 1;

        for (let pointer = 0; pointer < input.length; pointer++) {
            const prevChar = input[pointer-1];
            const char = input[pointer];
            const nextChar = input[pointer+1];

            // Handle comments
            if (isComment) {
                if (input.slice(pointer, pointer+3) === "-->") { 
                    isComment = false;
                    pointer = pointer+3;
                } else {
                    continue;
                }
            }

            // Handle strings
            if (isString) {
                // If current char is a quotation mark and the previous char is not a \, the string is complete
                if (char === "\"" && prevChar !== "\\") {
                    // Reset flag
                    isString = false;
                    // Push token
                    tokens.push({
                        type: "string",
                        value: temp,
                        line: currentLine,
                        col: pointer+1
                    });
                    // Reset temp value
                    temp = "";
                }
                // Or else we will push into temp
                else {
                    temp += char;
                }

                continue;
            }

            // Handle text
            if (isText) {
                // If current char is "<", then the text is complete
                if (char === "<") {
                    // Reset flag
                    isText = false;
                    // Push token
                    tokens.push({
                        type: "text",
                        value: temp,
                        line: currentLine,
                        col: pointer+1
                    });
                    // Reset temp value
                    temp = "";
                }
                // Or else we will push into temp
                else {
                    temp += char;
                    continue;
                }
            }

            switch (char) {
                // Punctuations
                case "<":
                case ">":
                case "/":
                case "=":
                    {
                        // Comments
                        if (input.slice(pointer, pointer+4) === "<!--") {
                            isComment = true;
                            pointer = pointer+4;
                        }
                        // Punctuations
                        else {
                            tokens.push({
                                type: "punc",
                                value: char,
                                line: currentLine,
                                col: pointer+1
                            });

                            // Begin finding text
                            if (char === ">") {
                                isText = true;
                            }
                        }

                        break;
                    }

                // Strings
                case "\"":
                    {
                        isString = true;

                        break;
                    }

                // Identifiers
                case " ":
                case "\n":
                    break;

                default:
                    // A valid unquoted attribute value in HTML is any string of text that is not 
                    // the empty string and that doesn’t contain spaces, tabs, line feeds, form 
                    // feeds, carriage returns, ", ', `, =, <, or >.
                    if (!(/[ \t\n\f\r"'`=<>]/.test(char))  /*IDEN_CHARACTERS.includes(char.toLowerCase())*/) {
                        temp += char;

                        // Check if next character is a whitespace, new line, or punctuations
                        // If not, we will stop recording this identifier immediately
                        if (
                            nextChar === " "  ||
                            nextChar === "\n" ||
                            nextChar === "\t" ||
                            nextChar === ">"  ||
                            nextChar === "<"  ||
                            nextChar === "/"  ||
                            nextChar === "="
                        ) {
                            // Push token
                            tokens.push({
                                type: "identifier",
                                value: temp,
                                line: currentLine,
                                col: pointer+1
                            });
                            // Reset temp value
                            temp = "";
                        }
                    } else {
                        throw new Error(`Compile time error: Unexpected character at line ${currentLine} col ${pointer+1}: "${char}".`);
                    }
            }
        }

        // If there is no closing quotation mark, throw en error
        if (isString) throw new Error(`Compile time error: No ending quotation mark.`);

        return tokens;
    }

    parse(tokens: Token[]): AST {
        const ast: AST = [];
        
        let bodies: (TagBody | string)[] = [];

        for (let count = 0; count < tokens.length; count++) {
            const token = tokens[count];
            
            if (bodies.length === 0) {
                switch (token.type) {
                    case "identifier":
                    case "text":
                        ast.push(token.value);
                        break;

                    case "string":
                        ast.push(`"${token.value}"`);
                        break;

                    case "punc":
                        if (token.value === "<") {
                            bodies.push({
                                name: "",
                                attributes: {},
                                children: [],
                                stage: "name"
                            });                            
                        } else {
                            throw new Error(`Compile time error: Unexpected punctuation at line ${token.line}.`);
                        }

                        break;

                    default:
                        throw new Error(`Compile time error: Unexpected token at line ${token.line}.`);
                }
            } else {
                const currentEl = bodies[bodies.length-1];

                switch(token.type) {
                    case "identifier":
                        // Identifier for name assignment
                        if (typeof currentEl !== "string" && currentEl.stage === "name" && currentEl.name === "") {
                            currentEl.name = token.value;
                            // Update stage to collecting attributes
                            currentEl.stage = "attr";
                        }
                        // Identifier for attribute assignment
                        else if (typeof currentEl !== "string" && currentEl.stage === "attr") {
                            const supposedEqual = tokens[count+1];
                            const supposedValue = tokens[count+2];

                            // Attributes with values
                            if (
                                supposedEqual.type === "punc" &&
                                supposedEqual.value === "=" &&
                                (supposedValue.type === "string" || supposedValue.type === "identifier")
                            ) {
                                currentEl.attributes[token.value] = supposedValue.value;

                                count+=2;
                            }
                            // Boolean attributes
                            else {
                                currentEl.attributes[token.value] = true;
                            }
                        // Some how the token list have an identifier in the body
                        } else if (
                            // Current el is at body state means it had a closing >
                            (typeof currentEl !== "string" && currentEl.stage === "body") ||
                            // If current el is just text, then we don't care
                            typeof currentEl === "string"
                        ) {
                            bodies.push(token.value);
                        } else {
                            throw new Error(`Compile time error: Unexpected identifier at line ${token.line}.`);
                        }

                        break;
                    
                    case "string":
                        // Some how the token list have a string in the body
                        if (// Current el is at body state means it had a closing >
                            (typeof currentEl !== "string" && currentEl.stage === "body") ||
                            // If current el is just text, then we don't care
                            typeof currentEl === "string"
                        ) {
                            bodies.push(`"${token.value}"`);
                        } else {
                            throw new Error(`Compile time error: Unexpected string at line ${token.line}.`);
                        }

                        break;

                    case "text":
                        // Can only push text as a children in body
                        if (
                            // Current el is at body state means it had a closing >
                            (typeof currentEl !== "string" && currentEl.stage === "body") ||
                            // If current el is just text, then we don't care
                            typeof currentEl === "string"
                        ) {
                            bodies.push(token.value);
                        } else {
                            throw new Error(`Compile time error: Unexpected text at line ${token.line}.`);
                        }

                        break;

                    case "punc":
                        if (
                            // Current el is at body state means it had a closing >
                            (typeof currentEl !== "string" && currentEl.stage === "body") ||
                            // If current el is just text, then we don't care
                            typeof currentEl === "string"
                        ) {
                            if (token.value === "<") {
                                const supposedClosing = tokens[count+1];
                                const supposedTag = tokens[count+2];
                                const supposedEnd = tokens[count+3];
                                
                                // Closing tag
                                if (
                                    supposedClosing?.type === "punc" &&
                                    supposedClosing?.value === "/"
                                ) {
                                    // Check if at least it is a closing tag
                                    if (
                                        supposedTag?.type === "identifier" &&
                                        supposedEnd?.type === "punc" &&
                                        supposedEnd?.value === ">"
                                    ) {
                                        // Check if it is the correct closing tag, only then will we push to parent
                                        for (let index = bodies.length-1; index >= 0; index--) {
                                            const el = bodies[index];
    
                                            if (
                                                typeof el !== "string" &&
                                                !el.strictlySingular &&
                                                supposedTag.value === el.name
                                            ) {
                                                el.children.push(...bodies.slice(index+1, bodies.length));
                                                bodies.splice(index+1, bodies.length);
                                            }
                                        }
                                    } else {
                                        throw new Error(`Compile time error: Unexpected punctuation at line ${token.line}.`);
                                    }
    
                                    count+=3;
                                }
                                // Opening tag
                                else {
                                    bodies.push({
                                        name: "",
                                        attributes: {},
                                        children: [],
                                        stage: "name"
                                    });
                                } 
                            } 
                        }

                        // Singular tags
                        if (token.value === "/" && typeof currentEl !== "string" && currentEl.stage !== "body") {
                            const supposedEnd = tokens[count+1];

                            if (supposedEnd?.type === "punc" && supposedEnd?.value === ">") {
                                currentEl.stage = "body";
                                currentEl.strictlySingular = true;
                                count+=1;
                            } else {
                                throw new Error(`Compile time error: Unexpected punctuation at line ${token.line}.`);
                            }
                        }

                        // End naming/attribute collecting and switch to collecting children
                        if (token.value === ">" && typeof currentEl !== "string") {
                            currentEl.stage = "body";
                        }

                        break;

                    default:
                        throw new Error(`Compile time error: Unexpected error at line ${token.line}.`);
                }
            }
        }

        ast.push(...bodies);

        return ast;
    }

    interpret(ast: AST): Result {
        const final: Result = { textStream: "", options: {} };

        for (const el of ast) {
            const { textStream, options } = this.getContent(el);   

            final.textStream += textStream;
            Object.assign(final.options, options);
        }

        return final;
    }

    getContent(el: TagBody | string, scope: (string | Scope)[] = []): Result {
        if (typeof el === "string")
            return {
                    textStream: this.sanitize(el),
                    options: {}
                };

        const final: Result = { textStream: "", options: {} };

        if (el.children.length <= 1) {
            const isEmpty = el.children.length === 0;

            // Furthest text content
            if (isEmpty || typeof el.children[0] === "string") {
                let value = this.sanitize(isEmpty ? "" : el.children[0] as string);

                switch (el.name) {
                    case "html":
                        // html tag should have no parents
                        if (scope.length === 0) {
                            final.textStream += value;
                        }

                    case "body":
                        // body tag should only have html as parent
                        if (scope.length === 1 && scope[0] === "html") {
                            final.textStream += value;
                        }

                        break;

                    case "title":
                        final.options.title = this.sanitize(value);

                        break;
                    
                    case "p":
                    case "h1":
                    case "h2":
                    case "h3":
                    case "h4":
                    case "h5":
                    case "h6":
                        let offset = "";    

                        if (final.textStream.slice(-2) === "\n\n") {
                            offset = "";
                        } else if (final.textStream.slice(-1) === "\n") {
                            offset += "\n";
                        } else {
                            offset += "\n\n";
                        }

                        final.textStream += `${offset}${value}\n\n`;
                    
                        break;
                    
                    case "br":
                    case "hr":
                        final.textStream += "\n";

                        break;
                    
                    case "div":
                        final.textStream += `\n${value}\n`;

                        break;

                    case "span":
                    case "a":
                    case "button":
                        final.textStream += value;

                        break;
                    
                    case "li":
                        final.textStream += `- ${value}\n`;

                        break;
                    
                    default:
                        // For unknown tags, we just treat them like normal text
                        final.textStream += value;

                        break;
                }
            }
            // Not furthest text content, search until find furthest text content
            else {
                const { textStream, options } = this.getContent(el.children[0], [ el.name, ...scope ]);  
 
                final.textStream += textStream;
                Object.assign(final.options, options);
            }
        } else {
            // Get content from children
            for (const childEl of el.children) {
                const { textStream, options } = this.getContent(childEl, [ el.name, ...scope ]);  

                final.textStream += textStream;
                Object.assign(final.options, options);
            }
        }

        return final;
    }

    sanitize(text: string): string {
        return decodeHtmlEntities(
            text
            .replaceAll("\n", "")
            .replaceAll("\t", "")
            .replace(/\s+/g, " ")
            .trim()
        );
    }
}
