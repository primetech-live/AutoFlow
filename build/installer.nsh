!macro customUnInstall
  DetailPrint "Cleaning up AutoFlow CLI wrapper & PATH variables..."
  
  # Delete CLI shim files from installation directory
  Delete "$INSTDIR\autoflow.cmd"
  Delete "$INSTDIR\autoflow.ps1"
  Delete "$INSTDIR\autoflow.exe"
  Delete "$INSTDIR\autoflow"

  # Safely remove installation directory from User PATH using PowerShell
  nsExec::ExecToLog 'powershell -NoProfile -ExecutionPolicy Bypass -Command "[System.Environment]::SetEnvironmentVariable(\"PATH\", (([System.Environment]::GetEnvironmentVariable(\"PATH\", \"User\").Split(\";\") | Where-Object { $_ -ne \"$INSTDIR\" }) -join \";\"), \"User\")"'

  DetailPrint "AutoFlow CLI successfully uninstalled."
!macroend
