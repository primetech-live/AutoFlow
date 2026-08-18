!macro customUnInstall
  DetailPrint "Cleaning up AutoFlow CLI wrapper & PATH variables..."
  
  # Delete CLI shim files from installation directory
  Delete "$INSTDIR\autoflow.cmd"
  Delete "$INSTDIR\autoflow.ps1"
  Delete "$INSTDIR\autoflow.exe"
  Delete "$INSTDIR\autoflow"

  # Delete local AppData binary files if present
  RMDir /r /REBOOTOK "$LOCALAPPDATA\Autoflow"
  RMDir /r /REBOOTOK "$APPDATA\Autoflow"

  # Safely remove installation directory & AppData from User/System PATH using PowerShell
  nsExec::ExecToLog 'powershell -NoProfile -ExecutionPolicy Bypass -Command "$$pathVal = [System.Environment]::GetEnvironmentVariable(\"PATH\", \"User\"); if ($$pathVal) { $$newPathVal = ($$pathVal.Split(\";\") | Where-Object { $$_ -ne \"$INSTDIR\" -and $$_ -ne \"$LOCALAPPDATA\\Autoflow\" -and $$_ -ne \"$APPDATA\\Autoflow\" }) -join \";\"; [System.Environment]::SetEnvironmentVariable(\"PATH\", $$newPathVal, \"User\") }"'

  DetailPrint "AutoFlow CLI successfully uninstalled."
!macroend
