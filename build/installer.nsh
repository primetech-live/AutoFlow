!macro customUnInstall
  DetailPrint "Cleaning up AutoFlow CLI wrapper & PATH variables..."
  
  # Delete CLI shim files from installation directory
  Delete "$INSTDIR\autoflow.cmd"
  Delete "$INSTDIR\autoflow.ps1"
  Delete "$INSTDIR\autoflow.exe"
  Delete "$INSTDIR\autoflow"

  # Delete local AppData binary files if present
  RMDir /r "$LOCALAPPDATA\Autoflow"
  Delete "$LOCALAPPDATA\Autoflow\cli.js"

  # Safely remove installation directory & npm global bin from User PATH using PowerShell
  nsExec::ExecToLog 'powershell -NoProfile -ExecutionPolicy Bypass -Command "$$p = [System.Environment]::GetEnvironmentVariable(\"PATH\", \"User\"); if ($$p) { $$p = ($$p.Split(\";\") | Where-Object { $$_ -ne \"$INSTDIR\" -and $$_ -ne \"$LOCALAPPDATA\\Autoflow\" }) -join \";\"; [System.Environment]::SetEnvironmentVariable(\"PATH\", $$p, \"User\") }"'

  DetailPrint "AutoFlow CLI successfully uninstalled."
!macroend
