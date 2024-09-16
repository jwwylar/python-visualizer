import * as vscode from 'vscode';
import {Command} from "../common/commandManager";
import {PythonVisualizerManager} from "../features/visualizerManager";

export class ShowSourceCommand implements Command {
    public readonly id = 'pythonVisualizer.showSource';

    public constructor(private readonly _visualizerManager: PythonVisualizerManager) {

    }

    public execute() {
        if (this._visualizerManager.activeVisualizerResource) {
            return vscode.workspace.openTextDocument(this._visualizerManager.activeVisualizerResource)
                                   .then(document => vscode.window.showTextDocument(document));
        }
        return undefined;
    }
}