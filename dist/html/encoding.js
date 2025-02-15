"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.entityMap = void 0;
exports.decodeHtmlEntities = decodeHtmlEntities;
exports.entityMap = {
    "lt": "<",
    "gt": ">",
    "amp": "&",
    "quot": "\"",
    "apos": "'",
    "nbsp": "\u00A0",
    "euro": "€",
    "copy": "©",
    "reg": "®"
};
function decodeHtmlEntities(str) {
    return str.replace(/&(#\d+;|#x[0-9A-Fa-f]+;|\w+;)/g, (match, entity) => {
        // Hex
        if (entity.startsWith("#x")) {
            return String.fromCharCode(parseInt(entity.slice(2, -1), 16));
        }
        // Dec
        else if (entity.startsWith("#")) {
            return String.fromCharCode(parseInt(entity.slice(1, -1), 10));
        }
        // Name
        else {
            return exports.entityMap[entity.slice(0, -1)] || match;
        }
    });
}
