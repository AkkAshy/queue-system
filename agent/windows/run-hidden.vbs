' Launches start-agent.bat with NO visible console window.
' Put a shortcut to THIS file into the Startup folder (shell:startup).
Dim sh, here
Set sh = CreateObject("WScript.Shell")
here = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
sh.Run """" & here & "\start-agent.bat""", 0, False
