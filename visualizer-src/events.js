"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onceDocumentLoaded = void 0;
function onceDocumentLoaded(f) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', f);
    }
    else {
        f();
    }
}
exports.onceDocumentLoaded = onceDocumentLoaded;
//# sourceMappingURL=events.js.map