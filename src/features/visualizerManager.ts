import * as vscode from "vscode";
import * as path from 'path';
import {PythonVisualizerConfigurationManager} from "./visualizerConfig";
import {PythonVisualizer} from "./visualizer";
import {PythonContentProvider} from "./visualizerContentProvider";
import {Logger} from "../common/logger";
import {disposeAll} from "../common/dispose";
import { IDebugServer, LaunchRequestArguments } from "../debugger/common/contracts";
import { PythonProcess } from "../debugger/pythonProcess";
import { BaseDebugClient } from "../debugger/debugClients/baseDebugClient";
import { BaseDebugServer } from "../debugger/debugServers/baseDebugServer";
import pvUtils from "../debugger/common/pvUtils";
import { DebuggerLauncherScriptProvider } from "../debugger/debugClients/launcherProvider";
import { LocalDebugClient } from "../debugger/debugClients/localDebugClient";
import { PythonOutput, PythonOutputStatus } from "./pythonOutput";
import { isNotInstalledError } from "../common/helpers";

export class PythonVisualizerManager implements vscode.WebviewPanelSerializer {
    private static readonly _pythonVisualizerActiveContextKey = 'pythonVisualizerFocus';

    private readonly _visualizerConfigurationManager = new PythonVisualizerConfigurationManager();
    private _visualizers: PythonVisualizer[] = [];
    private _activeVisualizer: PythonVisualizer | undefined = undefined;
    private readonly _disposables: vscode.Disposable[] = [];

    private _debuggerLoaded: Promise<any> | undefined;
    //private _debuggerLoadedPromiseResolve!: () => void;
    private _debuggerLoadedPromiseResolve!: (value?: any) => void; // Make the argument optional
    private _pythonProcess?: PythonProcess;
    private _debugClient?: BaseDebugClient<{}>;
    private _debugServer!: BaseDebugServer;
    private _launchArgs!: LaunchRequestArguments;
    private _cachedOutputs: Map<string, PythonOutput>;
    private _lang?: string;

    public constructor(private readonly _context: vscode.ExtensionContext,
                       private readonly _contentProvider: PythonContentProvider,
                       private readonly _logger: Logger){
        this._disposables.push(vscode.window.registerWebviewPanelSerializer(PythonVisualizer.viewtype, this));
        this._cachedOutputs = new Map<string, PythonOutput>();
    }

    public dispose(): void {
        disposeAll(this._disposables);
        disposeAll(this._visualizers);
        this._cachedOutputs.clear();
        this.stopDebugServer();
    }

    public refresh() {
        for (const visualizer of this._visualizers) {
            visualizer.initialContent();
        }
    }

    public updateConfiguration() {
        for (const visualizer of this._visualizers) {
            visualizer.updateConfiguration();
        }
    }

    public async visualizer(resource: vscode.Uri, visualizerSettings: VisualizerSettings): Promise<void> {
        // get pythonPath
        const resolvedPythonPath = await pvUtils.getPythonPath()
        // Log the value of resolvedPythonPath
        // console.log('Resolved Python Path in visualizer():', resolvedPythonPath);

        // For the first visualizer, create the debugger first.
        if (this._debuggerLoaded === undefined) {
            this._launchArgs = {
                pythonPath: resolvedPythonPath
            };
            this._debuggerLoaded = new Promise(resolve => {
                this._debuggerLoadedPromiseResolve = resolve;
            });
            this.createDebugger(this._launchArgs);
        }
        // 这段代码永远找不到已存在的visualizer，原因是visualizer的列输入参数是vscode.ViewColumn.Beside或者vscode.ViewColumn.Beside！！！
        // This code can never find the existing visualizer, because the column input parameter of visualizer is vscode.ViewColumn.Beside or vscode.ViewColumn.Beside! ! !
        let visualizer = this.getExistingVisualizer(resource, visualizerSettings);
        if (visualizer) {
            visualizer.reveal(visualizerSettings.visualizerColumn);
        } else {
            visualizer = this.createNewVisualizer(resource, visualizerSettings);
            visualizer.initialContent();
        }
    }

    public get activeVisualizerResource(): vscode.Uri | undefined {
        return this._activeVisualizer && this._activeVisualizer.resource;
    }

    public get lang() {
        return this._lang;
    }

    public toggleLock() {
        const visualizer = this._activeVisualizer;
        if (visualizer) {
            visualizer.toggleLock();
            // 关闭冗余的预览
            // Turn off redundant visualizers
            for (const otherVisualizer of this._visualizers) {
                if (otherVisualizer !== visualizer && visualizer.matches(otherVisualizer)) {
                    otherVisualizer.dispose();
                }
            }
        }
    }

    public async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: any): Promise<void> {
        
        const visualizer = await PythonVisualizer.receive(
            webviewPanel,
            state,
            this,
            this._context,
            this._cachedOutputs,
            this._contentProvider,
            this._visualizerConfigurationManager,
            this._logger);
        
        this.registerVisualizer(visualizer);
    }

    

    private getExistingVisualizer(resource: vscode.Uri, visualizerSettings: VisualizerSettings): PythonVisualizer | undefined {
        return this._visualizers.find(visualizer =>
            visualizer.matchesResource(resource, visualizerSettings.visualizerColumn, visualizerSettings.locked));
    }

    private createNewVisualizer(resource: vscode.Uri, visualizerSettings: VisualizerSettings): PythonVisualizer {
        const visualizer = PythonVisualizer.create(resource,
                                             visualizerSettings.visualizerColumn,
                                             visualizerSettings.locked,
                                             this,
                                             this._context,
                                             this._cachedOutputs,
                                             this._contentProvider,
                                             this._visualizerConfigurationManager,
                                             this._logger);

        this.setVisualizerActiveContext(true);
        this._activeVisualizer = visualizer;
        return this.registerVisualizer(visualizer);
    }

    private registerVisualizer(visualizer: PythonVisualizer): PythonVisualizer {
        this._visualizers.push(visualizer);

        visualizer.onDidDispose(() => {
            const existing = this._visualizers.indexOf(visualizer);
            if (existing === -1) {
                return;
            }
            this._visualizers.splice(existing, 1);
            if (this._activeVisualizer === visualizer) {
                this.setVisualizerActiveContext(false);
                this._activeVisualizer = undefined;
            }
            if (this._visualizers.length === 0) {
                this.stopDebugServer();
                this._cachedOutputs.clear();
            } else {
                const isSameResource = this._visualizers.some(item => {
                    if (item.resource.fsPath == visualizer.resource.fsPath) return true;
                });
                if (!isSameResource && this._cachedOutputs.has(visualizer.resource.fsPath)) {
                    this._cachedOutputs.delete(visualizer.resource.fsPath);
                }
            }

        });

        visualizer.onDidChangeViewState(({ webviewPanel }) => {
            disposeAll(this._visualizers.filter(otherVisualizer => visualizer !== otherVisualizer && visualizer!.matches(otherVisualizer)));
            this.setVisualizerActiveContext(webviewPanel.active);
            this._activeVisualizer = webviewPanel.active ? visualizer : undefined;
        });

        return visualizer;
    }

    private setVisualizerActiveContext(value: boolean) {
        vscode.commands.executeCommand('setContext', PythonVisualizerManager._pythonVisualizerActiveContextKey, value);
    }
    
    public async createDebugger(args: LaunchRequestArguments): Promise<void> {
        // get pythonPath
        const resolvedPythonPath = await pvUtils.getPythonPath()

        // Log the value of resolvedPythonPath
        // console.log('Resolved Python Path in createDebugger():', resolvedPythonPath);

        try {
            args.pythonPath = resolvedPythonPath;
        } catch (ex) { }

        this._launchArgs = args;
        let launchScriptProvider = new DebuggerLauncherScriptProvider();
        this._debugClient = new LocalDebugClient(args, launchScriptProvider, this, this._logger);
        
        const that = this;
        this.startDebugServer().then(debugServer => {
            this._logger.info(`Started Debug Server. It is listening port - ${debugServer.port}`);
            return that._debugClient!.launchApplicationToDebug(debugServer);
        }).catch(error => {
            let errorMsg = typeof error === 'string' ? error : ((error.message && error.message.length > 0) ? error.message : error);
            if (isNotInstalledError(error)) {
                errorMsg = `Failed to launch the Python Process, please valiate the path '${this._launchArgs.pythonPath}'`;
            }
            vscode.window.showErrorMessage(errorMsg);
            this._logger.error('Starting Debugger with error.', errorMsg);
            this.dispose();
        });
    }

    private initializeEventHandlers(): void {
        const pythonProcess = this._pythonProcess!;
        pythonProcess.on('processLoaded', (pythonVersion: string) => this.onPythonProcessLoaded(pythonVersion));
        pythonProcess.on('output', (fileName: string, output: string) => this.onDebuggerOutput(fileName, output));
        pythonProcess.on('detach', () => this.onDetachDebugger());
    
        this._debugServer.on('detach', () => this.onDetachDebugger());
    }
    
    public async postMessageToDebugger(fileName: string, code: string): Promise<void> {
        // get pythonPath
        const resolvedPythonPath = await pvUtils.getPythonPath();
    
        // Log the value of resolvedPythonPath
        // console.log('Resolved Python Path in postMessageToDebugger():', resolvedPythonPath);
    
        if (this._debuggerLoaded === undefined) {
            this._launchArgs = {
                pythonPath: resolvedPythonPath,
            };
            this._debuggerLoaded = new Promise<void>((resolve) => {
                this._debuggerLoadedPromiseResolve = resolve;
            });
            this.createDebugger(this._launchArgs);
        }
        this._debuggerLoaded.then(() => {
            let output = this._cachedOutputs.get(fileName);
            // 第一次传送数据，则直接传送
            // The first time to send data, then send it directly
            if (!output) {
                output = new PythonOutput();
                this._cachedOutputs.set(fileName, output);
                this.sendMessage(fileName, code);
                output.status = PythonOutputStatus.Initialized;
            } else {
                // 如果是之后的传送，则设置定时器
                // If it is a later transfer, set the timer
                clearTimeout(output.throttleTimer);
                output.throttleTimer = setTimeout(() => {
                    this.sendMessage(fileName, code);
                    output.status = PythonOutputStatus.Processing;
                    output.throttleTimer = undefined;
                }, 300);
            }
        });
    }

    private sendMessage(fileName: string, code: string) {
        const config = this._visualizerConfigurationManager.getConfigCacheForResource(vscode.Uri.file(fileName));
        const folder = PythonVisualizerManager.getWorkspacePathOrPathRealtiveToFile(fileName);
        const cumulativeMode = config.traceConfig.cumulativeMode;
        const allowAllModules = config.traceConfig.allowAllModules;
        const maxExecutedLines = config.traceConfig.maxExecutedLines;
        this._logger.info('Sending executed code to debugger');
        this._pythonProcess!.sendExecutableText(folder, fileName, code, cumulativeMode, allowAllModules, maxExecutedLines);
    }

    private static getWorkspacePathOrPathRealtiveToFile(fileName: string) {
        let root = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(fileName));
        if (root) {
            return root.uri.fsPath;
        }
        return path.dirname(fileName);
    }

    private onPythonProcessLoaded(pythonVersion: string) {
        this._logger.info('Python Process loaded');
        this._lang = `Python ${pythonVersion}`;
        this._debuggerLoadedPromiseResolve();
    }

    private onDebuggerOutput(fileName: string, output: string) {
        const data = JSON.parse(output);
        let cacheOutput = this._cachedOutputs.get(fileName)!;
        cacheOutput.status = PythonOutputStatus.Prcoessed;
        cacheOutput.trace = data;
        this._visualizers.forEach(item => {
            if (item.isVisualizerOf(vscode.Uri.file(fileName))) {
                if (item.visibale) {
                    item.updateContent();
                }
            }
        });
    }

    public onDetachDebugger() {
        this.stopDebugServer();
    }

    private startDebugServer(): Promise<IDebugServer> {
        this._pythonProcess = new PythonProcess(0, '');
        this._debugServer = this._debugClient!.createDebugServer(this._pythonProcess);
        this.initializeEventHandlers();
        this._logger.info('Starting Debug Server');
        return this._debugServer.start();
    }

    private stopDebugServer() {
        if (this._debugClient) {
            this._debugClient!.stop();
            this._debugClient = undefined;
        }
        if (this._pythonProcess) {
            this._pythonProcess!.kill();
            this._pythonProcess = undefined;
        }
        this._debuggerLoaded = undefined;
        if (this._lang) {
            this._lang = undefined;
            this._logger.info('Debugger exited');
        }
    }

}

export interface VisualizerSettings {
    readonly resourceColumn: vscode.ViewColumn;
    readonly visualizerColumn: vscode.ViewColumn;
    readonly locked: boolean;
}
