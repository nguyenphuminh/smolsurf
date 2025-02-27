## What is Smolsurf?

Smolsurf is a text-based web browser, which means it only renders web pages as text and can be run from the command line. Currently it's just a toy project for me to mess around with, and I might make several breaking changes in the future.

## Aims

* Neat for reading document sites.
* Works well in low bandwidth internet.
* Works well in potato machines (though this would require migrating from Node.js).
* Rewrite most if not everything from scratch.

## What we currently have:

* A text-based command line interface.
* A new html engine that does not follow any standards.
* Cross-platform support as long as Node.js is supported.
* Searches done through Mojeek.

## Using Smolsurf

You can download a binary from the releases page, run compiled distribution, or build from source.

### Build from source

1. Install Node.js & npm.
2. Clone this repo:
```
git clone https://github.com/nguyenphuminh/smolsurf
```
3. Install dev dependencies:
```
npm install
```
4. Build:
```
npm run build
```

But of course you can just do this to run directly in Node.js:
```
node .
```

## Short-term todos

* Support more HTML tags.
* Support more encoded entities.
* Make the UI less terrible.
* idk it is kind of a mess right now so there are a lot of bugs to fix.
* Port to Rust or Go.

## Copyrights

Copyrights © 2025 Nguyen Phu Minh.

This project is licensed under the GPL-3.0 License.
