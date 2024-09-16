import {workspace} from "vscode"

/**
 * simple alias for workspace.getConfiguration("pythonVisualizer")
 */
export function settings(){
    return workspace.getConfiguration("pythonVisualizer")
}