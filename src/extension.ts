import * as vscode from 'vscode';
import { Logger } from './common/logger';
import { PythonContentProvider } from './features/visualizerContentProvider';
import { PythonVisualizerManager } from './features/visualizerManager';
import { CommandManager } from './common/commandManager';
import * as commands from './commands';

export function activate(context: vscode.ExtensionContext) {
    const logger = new Logger();

    const contentProvider = new PythonContentProvider(context, logger);
    const visualizerManager = new PythonVisualizerManager(context, contentProvider, logger);
    context.subscriptions.push(visualizerManager);

    const commandManager = new CommandManager();
    context.subscriptions.push(commandManager);
    commandManager.register(new commands.ShowVisualizerCommand(visualizerManager));
    commandManager.register(new commands.ShowVisualizerToSideCommand(visualizerManager));
    commandManager.register(new commands.ShowLockedVisualizerToSideCommand(visualizerManager));
    commandManager.register(new commands.ShowSourceCommand(visualizerManager));
    commandManager.register(new commands.RefreshVisualizerCommand(visualizerManager));
    commandManager.register(new commands.ToggleLockCommand(visualizerManager));

    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(() => {
        logger.updateConfiguration();
        visualizerManager.updateConfiguration();
    }))
}