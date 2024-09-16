import { Command } from "../common/commandManager";
import { PythonVisualizerManager } from "../features/visualizerManager";

export class RefreshVisualizerCommand implements Command {
    public readonly id = 'pythonVisualizer.refresh';

    public constructor(private readonly _visualizerManager: PythonVisualizerManager) { }

    public execute() {
        this._visualizerManager.refresh();
    }
}