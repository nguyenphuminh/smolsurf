export const entityMap: Record<string, string> = {
    "lt": "<",
    "gt": ">",
    "amp": "&",
    "quot": "\"",
    "apos": "'",
    "nbsp": "\u00A0",
    "euro": "€",
    "copy": "©",
    "reg": "®"
}

export function decodeHtmlEntities(str: string) {
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
            return entityMap[entity.slice(0, -1)] || match;
        }
    });
}
