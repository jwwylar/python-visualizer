# Python Visualizer extension for Visual Studio Code

Experience a new dimension of coding with the "Python Visualizer" extension for [Visual Studio Code](https://code.visualstudio.com/). This extension introduces interactive visualization of Python code execution for the [Python language](https://www.python.org/).

# IMPORTANT NOTES: 

The [original project](https://github.com/dongli0x00/python-preview) was abandoned since 2018.

We do not have access to a Mac, so we haven't been able to test this extension on one yet. If you're using a Mac, we’d appreciate it if you could let us know whether it works.

## Functionalities and Configuration

![Visualizer](https://github.com/jwwylar/python-visualizer/tree/main/images/previewDemo.gif)

![Setting](https://github.com/jwwylar/python-visualizer/tree/main/images/settingDemo.gif)

# Version 1.0.0

# Initial release.

# Python Visualizer Extension: What's New in Version 1.0.0

## Improved "pythonPath" Configuration

Say goodbye to common issues like "Failed to launch the Python Process." We've enhanced the "pythonPath" configuration for a more robust experience.

### Case 1: Official VS Code Python Extension Installed (Recommended)

When you have the "official VS Code Python extension" installed, Python Visualizer seamlessly adopts its pythonPath.

### Case 2: Official VS Code Python Extension Not Installed

If you prefer to set up a specific pythonPath, configuring it in Python Visualizer's settings is easy. Leaving the "pythonPath" field empty in Python Visualizer's settings will automatically apply defaults based on your platform. On Windows, it will use the "py" command. On other platforms, it will use "python3."

## Modernized VS Code Extension APIs

We've kept up with the times by updating the VS Code engine from version "1.26.0" to version "1.80.0.". This ensures compatibility and utilizes the latest features. Additionally, we've transitioned away from outdated uses of Webviews' hardcoded "vscode-resource" to the more contemporary "asWebviewUri."

## Updated NPM Packages and Tools

We've taken care of the technical details by upgrading outdated NPM packages and software tools to their newer versions. This behind-the-scenes work guarantees a smoother experience for you without any hassle.

## Bug Fixes

Our commitment to quality shines through as we've diligently addressed bugs. This translates to a more stable and reliable Python Visualizer, allowing you to focus on your code without interruptions.

## Settings Enhancements

### Smarter "pythonPath" Handling

Configuring the "pythonPath" is now even more streamlined. With the "official VS Code Python extension," our extension seamlessly aligns with its settings. Without it, specify the pythonPath in our extension's settings effortlessly. And if you prefer simplicity, leave it blank for platform-based defaults.

### Effortless Environment Variables

You can specify the full path to a file containing environment variable definitions using this option. If you leave it blank and have the official VS Code Python extension installed, the value will be automatically retrieved from the settings of the official extension. However, if the official Python extension is not installed, and you haven't filled in this field, the default path will be ${workspaceFolder}/.env. 

## Prerequisites

We highly recommend installing the official [Python Extension](https://marketplace.visualstudio.com/items?itemName=ms-python.python) for optimal compatibility.


## Version History

Explore all the updates we've made in our [change log](https://github.com/jwwylar/python-visualizer/blob/main/CHANGELOG.md).

## Acknowledgments

Our deepest gratitude extends to the following projects:

- [dongli0x00/python-preview](https://github.com/dongli0x00/python-preview)
- [pythontutor.com](https://pythontutor.com/)
- [hcientist/OnlinePythonTutor](https://github.com/hcientist/OnlinePythonTutor)
- [vscode-official-python-extension](https://github.com/Microsoft/vscode-python)
- [markdown-language-features](https://github.com/Microsoft/vscode/tree/master/extensions/markdown-language-features)
- [Almenon/AREPL-vscode](https://github.com/Almenon/AREPL-vscode)

And lastly, a sincere appreciation to the [Python](https://www.python.org/) development team and community as well as the remarkable [vscode team!](https://github.com/Microsoft/vscode/graphs/contributors)