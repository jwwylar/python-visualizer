import * as vscode from 'vscode';
import {Command} from "../common/commandManager";
import {PythonVisualizerManager} from "../features/visualizerManager";

interface ShowVisualizerSettings {
    readonly sideBySide: boolean;
    readonly locked: boolean;
}

async function showVisualizer(visualizerManager: PythonVisualizerManager,
                           uri: vscode.Uri | undefined,
                           visualizerSettings: ShowVisualizerSettings): Promise<any> {
    let resource = uri;
    if (!(resource instanceof vscode.Uri)) {
        if (vscode.window.activeTextEditor) {
            resource = vscode.window.activeTextEditor.document.uri;
        } else {
            return vscode.commands.executeCommand('pythonVisualizer.showSource');
        }
    }
    
    visualizerManager.visualizer(resource, {
        resourceColumn: (vscode.window.activeTextEditor && vscode.window.activeTextEditor.viewColumn) || vscode.ViewColumn.One,
        visualizerColumn: visualizerSettings.sideBySide ? vscode.ViewColumn.Beside : vscode.ViewColumn.Active,
        locked: visualizerSettings.locked
    });
}

/**
 * 
 */
export class ShowVisualizerCommand implements Command {
    public readonly id = 'pythonVisualizer.showVisualizer';

    public constructor(private readonly _prviewManager: PythonVisualizerManager) { }

    public execute() {
        showVisualizer(this._prviewManager, undefined, {
            sideBySide: false,
            locked: false 
        });
    }
}


export class ShowVisualizerToSideCommand implements Command {
    public readonly id = 'pythonVisualizer.showVisualizerToSide';

    public constructor(private readonly _visualizerManager: PythonVisualizerManager) { }

    public execute() {
        showVisualizer(this._visualizerManager, undefined, {
            sideBySide: true,
            locked: false
        });
    }
}

export class ShowLockedVisualizerToSideCommand implements Command {
    public readonly id = 'pythonVisualizer.showLockedVisualizerToSide';

    public constructor(private readonly _visualizerManager: PythonVisualizerManager) { }

    public execute() {
        showVisualizer(this._visualizerManager, undefined, {
            sideBySide: true,
            locked: true
        });
    }
}