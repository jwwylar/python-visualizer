import { Command } from "../common/commandManager";
import { PythonVisualizerManager } from "../features/visualizerManager";

export class ToggleLockCommand implements Command {
    public readonly id = 'pythonVisualizer.toggleLock';

    public constructor(private readonly _visualizerManager: PythonVisualizerManager) {

    }

    public execute() {
        this._visualizerManager.toggleLock();
    }
}