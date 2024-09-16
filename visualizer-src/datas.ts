export interface VisualizerState {
    resource: string,
    locked: boolean,
    startingInstruction: number,
    width: number
}

export function getDataState(): VisualizerState {
    const element = document.getElementById('vscode-python-visualizer-data');
    if (element) {
        const dataState = element.getAttribute('data-state')
        if (dataState) {
            return JSON.parse(dataState);
        }
    }

    throw new Error(`Could not load data state`);
}