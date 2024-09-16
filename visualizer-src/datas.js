"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDataState = void 0;
function getDataState() {
    const element = document.getElementById('vscode-python-preview-data');
    if (element) {
        const dataState = element.getAttribute('data-state');
        if (dataState) {
            return JSON.parse(dataState);
        }
    }
    throw new Error(`Could not load data state`);
}
exports.getDataState = getDataState;
//# sourceMappingURL=datas.js.map