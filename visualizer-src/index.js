"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pytutor_1 = require("./pytutor");
const datas_1 = require("./datas");
const messaging_1 = require("./messaging");
const vscode = acquireVsCodeApi();
// 设置vscode状态
// Setting VSCode status.
const state = (0, datas_1.getDataState)();
vscode.setState(state);
const messagePoster = (0, messaging_1.createPosterForVsCode)(vscode);
let pyOutputPane;
window.addEventListener('message', event => {
    switch (event.data.type) {
        case 'updateContent':
            event.data.options.updateOutputCallback = visualizer => {
                state.startingInstruction = visualizer.curInstr;
                vscode.setState(state);
                messagePoster.postMessage('updateStartingInstruction', { curInstr: visualizer.curInstr });
            };
            pyOutputPane = new pytutor_1.ExecutionVisualizer('pyOutputPane', event.data.data, event.data.options);
            pyOutputPane.redrawConnectors();
            break;
        case 'updateLock':
            state.locked = event.data.locked;
            vscode.setState(state);
            break;
    }
});
$(window).resize(() => {
    if (pyOutputPane) {
        pyOutputPane.redrawConnectors();
        let width = document.getElementById('codAndNav').style['width'];
        state.width = parseFloat(width.slice(0, -2));
        messagePoster.postMessage('updateCodAndNavWidth', { width: state.width });
    }
});
//# sourceMappingURL=index.js.map