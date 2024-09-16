import * as vscode from 'vscode';
import * as path from "path";

import {PythonContentProvider} from "./visualizerContentProvider";
import {PythonVisualizerConfigurationManager} from "./visualizerConfig";
import {Logger} from "../common/logger";
import {disposeAll} from "../common/dispose";
import { PythonVisualizerManager } from './visualizerManager';
import { isPythonFile } from '../common/file';
import { PythonOutput, PythonOutputStatus } from './pythonOutput';

export interface VisualizerState {
    readonly resource: string;
    readonly locked: boolean;
    readonly startingInstruction: number
    readonly width: number;
}

export class PythonVisualizer {
    public static viewtype = 'pythonVisualizer';

    private _resource: vscode.Uri;
    private _locked: boolean;
    private _startingInstrcution: number | undefined;

    private _codAndNavWidth: number | undefined;

    private readonly _webviewPanel: vscode.WebviewPanel;
    private readonly _disposables: vscode.Disposable[] = [];
    private _currentVersion?: { resource: vscode.Uri, version: number };
    private _disposed: boolean = false;
    private readonly _onDidDisposeEmitter = new vscode.EventEmitter<void>();
    public readonly onDidDispose = this._onDidDisposeEmitter.event;

    private readonly _onDidChangeViewStateEmitter = new vscode.EventEmitter<vscode.WebviewPanelOnDidChangeViewStateEvent>();
    public readonly onDidChangeViewState = this._onDidChangeViewStateEmitter.event;



    // 反序列化时使用
    // When deserialization is used

    public static async receive(webviewPanel: vscode.WebviewPanel,
                                state: VisualizerState,
                                visualizerManager: PythonVisualizerManager,
                                context: vscode.ExtensionContext,
                                cachedOutputs: Map<string, PythonOutput>,
                                contentProvider: PythonContentProvider,
                                visualizerConfigurationManager: PythonVisualizerConfigurationManager,
                                logger: Logger): Promise<PythonVisualizer> {
        const resource = vscode.Uri.parse(state.resource);
        const locked = state.locked;
        const startingInstruction = state.startingInstruction;
        const width = state.width;

        const visualizer = new PythonVisualizer(webviewPanel,
                                          resource,
                                          locked,
                                          startingInstruction,
                                          width,
                                          visualizerManager,
                                          context,
                                          cachedOutputs,
                                          contentProvider,
                                          visualizerConfigurationManager,
                                          logger);

        await visualizer.doUpdate();
        return visualizer;
    }

    public static create(resource: vscode.Uri,
                         visualizerColumn: vscode.ViewColumn,
                         locked: boolean,
                         visualizerManager: PythonVisualizerManager,
                         context: vscode.ExtensionContext,
                         cachedOutputs: Map<string, PythonOutput>,
                         contentProvider: PythonContentProvider,
                         visualizerConfigurationManager: PythonVisualizerConfigurationManager,
                         logger: Logger): PythonVisualizer {
        const webviewPanel = vscode.window.createWebviewPanel(PythonVisualizer.viewtype,
                                                              PythonVisualizer.getVisualizerTitle(resource, locked),
                                                              visualizerColumn,
                                                              {
                                                                  enableFindWidget: true,
                                                                  ...PythonVisualizer.getWebviewOptions(resource, context)
                                                              });
        return new PythonVisualizer(webviewPanel,
                                 resource,
                                 locked,
                                 undefined,
                                 undefined,
                                 visualizerManager,
                                 context,
                                 cachedOutputs,
                                 contentProvider,
                                 visualizerConfigurationManager,
                                 logger);
    }

    private constructor(webviewPanel: vscode.WebviewPanel,
                        resource: vscode.Uri,
                        locked: boolean,
                        staringInstruction: number | undefined,
                        width: number | undefined,
                        private readonly _visualizerManager: PythonVisualizerManager,
                        private readonly _context: vscode.ExtensionContext,
                        private readonly _cachedOutputs: Map<string, PythonOutput>,
                        private readonly _contentProvider: PythonContentProvider,
                        private readonly _visualizerConfigurationManager: PythonVisualizerConfigurationManager,
                        private readonly _logger: Logger) {
        this._resource = resource;
        this._locked = locked;
        this._startingInstrcution = staringInstruction;
        this._codAndNavWidth = width;
        this._webviewPanel = webviewPanel;

        this._webviewPanel.onDidDispose(() => {
            this.dispose();
        }, null, this._disposables);

        this._webviewPanel.onDidChangeViewState(e => {
            this.updateContentWithStatus(true);
            this._onDidChangeViewStateEmitter.fire(e);
        }, null, this._disposables);

        // 处理来自webview的消息
        // Handling messages from WebView.
        this._webviewPanel.webview.onDidReceiveMessage(e => {
            if (e.source !== this._resource.toString()) {
                return;
            }

            switch (e.type) {
                case 'command':
                    vscode.commands.executeCommand(e.body.command, ...e.body.args);
                    break;
                case 'updateStartingInstruction':
                    this.onDidUpdateStartingInstruction(e.body.curInstr);
                    break;
                case 'updateCodAndNavWidth':
                    this.onDidUpdataCodAndNavWidth(e.body.width);
                    break;
            }
        }, null, this._disposables);

        vscode.workspace.onDidChangeTextDocument(event => {
            if (this.isVisualizerOf(event.document.uri)) {
                // 文本改变直接传送给调试器，等待调试器返回trace
                // Text changes are sent directly to the debugger, waiting for the debugger to return a trace.
                this._visualizerManager.postMessageToDebugger(event.document.fileName, event.document.getText());
            }
        }, null, this._disposables);

        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor && isPythonFile(editor.document) && !this._locked) {
                this.update(editor.document.uri);
            }
        }, null, this._disposables);
    }

    public get resource(): vscode.Uri {
        return this._resource;
    }

    public get locked(): boolean {
        return this._locked;
    }

    public get state(): VisualizerState {
        return {
            resource: this._resource.toString(),
            locked: this._locked,
            startingInstruction: this._startingInstrcution,
            width: this._codAndNavWidth
        };
    }

    public get visibale(): boolean {
        return this._webviewPanel.visible;
    }

    public get position(): vscode.ViewColumn | undefined {
        return this._webviewPanel.viewColumn;
    }

    public get disposed(): boolean {
        return this._disposed;
    }

    public dispose() {
        if (this._disposed) {
            return;
        }

        this._disposed = true;
        this._onDidDisposeEmitter.fire();

        this._onDidDisposeEmitter.dispose();
        this._onDidChangeViewStateEmitter.dispose();
        this._webviewPanel.dispose();

        disposeAll(this._disposables);
        
    }

    public updateConfiguration() {
        if (this._visualizerConfigurationManager.hasConfigurationChanged(this._resource)) {
            this.initialContent();
        }
    }

    public update(resource: vscode.Uri) {
        const isResourceChange = resource.fsPath !== this._resource.fsPath;
        if (isResourceChange) {
            this._resource = resource;
            this._startingInstrcution = undefined;
            this.initialContent();
        }
    }

    public async doUpdate(): Promise<void> {
        const document = await vscode.workspace.openTextDocument(this._resource);
        this._currentVersion = { resource: this._resource, version: document.version };
        this._webviewPanel.title = PythonVisualizer.getVisualizerTitle(this._resource, this._locked);
        this._webviewPanel.webview.options = PythonVisualizer.getWebviewOptions(this._resource, this._context);
        this._webviewPanel.webview.html = this._contentProvider.provideTextDocumentContent(document, this._visualizerConfigurationManager, this._webviewPanel.webview, this.state);
        this._visualizerManager.postMessageToDebugger(document.fileName, document.getText());
    }

    public async initialContent(): Promise<void> {
        const document = await vscode.workspace.openTextDocument(this._resource);
        
        this._webviewPanel.title = PythonVisualizer.getVisualizerTitle(this._resource, this._locked);
        this._webviewPanel.webview.options = PythonVisualizer.getWebviewOptions(this._resource, this._context);
        this._webviewPanel.webview.html = this._contentProvider.provideTextDocumentContent(document, this._visualizerConfigurationManager, this._webviewPanel.webview, this.state);

        this._visualizerManager.postMessageToDebugger(document.fileName, document.getText());
    }

    public async updateContent(): Promise<void> {
        const document = await vscode.workspace.openTextDocument(this._resource);
        if (this._currentVersion && this._resource.fsPath === this._currentVersion.resource.fsPath && document.version === this._currentVersion.version) {
            this.updateContentWithStatus(true);
        } else {
            this.updateContentWithStatus(false);
        }
        this._currentVersion = { resource: this._resource, version: document.version };
    }

    public updateStatus() {
        this._startingInstrcution = undefined;
    }

    public updateContentWithStatus(hasStatus: boolean) {
        const cacheOutput = this._cachedOutputs.get(this._resource.fsPath);
        // 如果此时还没有缓存的输出或者正在调试中，则直接返回
        // If there is no cached output or if debugging is in progress at this moment, it will return directly.
        if (!cacheOutput || cacheOutput.status !== PythonOutputStatus.Prcoessed) return;
        const config = this._visualizerConfigurationManager.getConfigCacheForResource(this._resource);
        if (this._codAndNavWidth === undefined) {
            this._codAndNavWidth = config.contentConfig.codAndNavWidth;
        }
        const options = {
            jumpToEnd: true,
            startingInstruction: undefined,
            disableHeapNesting: config.contentConfig.disableHeapNesting,
            textualMemoryLabels: config.contentConfig.textualMemoryLabels,
            compactFuncLabels: config.contentConfig.compactFuncLabels,
            showAllFrameLabels: config.contentConfig.showAllFrameLabels,
            hideCode: config.contentConfig.hideCode,
            lang: this._visualizerManager.lang,
            width: this._codAndNavWidth
        };
        if (hasStatus) options.startingInstruction = this._startingInstrcution;
        if (this.position) {
            this._logger.info(`Updating ${PythonVisualizer.getVisualizerTitle(this._resource, this._locked)} (Group ${this.position})`);
        } else {
            this._logger.info(`Updating ${PythonVisualizer.getVisualizerTitle(this._resource, this._locked)}`);
        }
        this.postMessage({
            type: 'updateContent',
            data: cacheOutput.trace,
            options: options
        });
    }

    public matchesResource(otherResource: vscode.Uri,
                           otherPosition: vscode.ViewColumn | undefined,
                           otherLocked: boolean): boolean {
        if (this.position !== otherPosition) {
            return false;
        }

        if (this._locked !== otherLocked) {
            return false;
        }

        return this.isVisualizerOf(otherResource);
    }

    public matches(otherVisualizer: PythonVisualizer): boolean {
        return this.matchesResource(otherVisualizer._resource, otherVisualizer.position, otherVisualizer._locked);
    }

    public reveal(viewColumn: vscode.ViewColumn) {
        this._webviewPanel.reveal(viewColumn);
    }

    public toggleLock() {
        this._locked = !this._locked;
        this._webviewPanel.title = PythonVisualizer.getVisualizerTitle(this._resource, this._locked);
        this.postMessage({
            type: 'updateLock',
            locked: this._locked
        });
    }

    public isVisualizerOf(resource: vscode.Uri): boolean {
        return this._resource.fsPath === resource.fsPath;
    }

    public static getVisualizerTitle(resource: vscode.Uri, locked: boolean): string {
        return locked
            ? `[Visualizer] ${path.basename(resource.fsPath)}`
            : `Visualizer ${path.basename(resource.fsPath)}`;
    }

    private postMessage(msg: any) {
        if (!this._disposed) {
            this._webviewPanel.webview.postMessage(msg);
        }
    }

    private static getWebviewOptions(resource: vscode.Uri, context: vscode.ExtensionContext): vscode.WebviewOptions {
        return {
            enableScripts: true,
            enableCommandUris: true,
            localResourceRoots: PythonVisualizer.getLocalResourceRoots(resource, context)
        };
    }

    private static getLocalResourceRoots(resource: vscode.Uri, context: vscode.ExtensionContext): vscode.Uri[] {
        const baseRoots = [vscode.Uri.file(context.extensionPath)];

        const folder = vscode.workspace.getWorkspaceFolder(resource);
        folder && baseRoots.push(folder.uri);

        (!resource.scheme || resource.scheme === 'file') && baseRoots.push(vscode.Uri.file(path.dirname(resource.fsPath)));

        return baseRoots;
    }

    private onDidUpdateStartingInstruction(curInstr: number) {
        this._startingInstrcution = curInstr;
    }

    private onDidUpdataCodAndNavWidth(width: number) {
        this._codAndNavWidth = width;
    }
}