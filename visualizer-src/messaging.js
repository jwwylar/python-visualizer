"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPosterForVsCode = void 0;
const datas_1 = require("./datas");
const createPosterForVsCode = (vscode) => {
    return new class {
        postMessage(type, body) {
            vscode.postMessage({
                type: type,
                source: (0, datas_1.getDataState)().resource,
                body: body
            });
        }
        postCommand(command, args) {
            this.postMessage('command', { command, args });
        }
    };
};
exports.createPosterForVsCode = createPosterForVsCode;
//# sourceMappingURL=messaging.js.map