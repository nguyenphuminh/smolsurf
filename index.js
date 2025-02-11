process.removeAllListeners("warning");

const { CLI } = require("./dist/cli/cli");

const cli = new CLI();
cli.listen();
