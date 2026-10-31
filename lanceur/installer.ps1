# Installe (ou désinstalle) le lanceur PDFEdit Or (web) pour l'utilisateur courant. Aucun droit administrateur requis.
#   installer.ps1                    installe
#   installer.ps1 -Desinstaller      retire tout (programme, entrées de registre)
#   installer.ps1 -Simuler -Dossier C:\temp\essai    compile et copie, sans toucher au registre (pour tester)
# Windows interdit à un programme de se déclarer lui-même « application par défaut » : après l'installation, vous choisissez
# vous-même « PDFEdit Or (web) » (clic droit sur un PDF → Ouvrir avec → Toujours), une seule fois par type de fichier.
param(
  [string]$Dossier = (Join-Path $env:LOCALAPPDATA 'PDFEditOr-Lanceur'),
  [switch]$Desinstaller,
  [switch]$Simuler
)
$ErrorActionPreference = 'Stop'
$ici = Split-Path -Parent $MyInvocation.MyCommand.Path
$exe = Join-Path $Dossier 'PDFEditOrLauncher.exe'
$progId = 'PDFEditOrLanceur.Fichier'
$appKey = 'PDFEditOrLanceur'
$extensions = '.pdf', '.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif'
$nom = 'PDFEdit Or (web)'

function Reg-Set($chemin, $nom, $valeur, $type = 'String') {
  if ($Simuler) { Write-Host "   [simulation] HKCU\$chemin  $nom = $valeur"; return }
  $k = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey($chemin)
  $k.SetValue($nom, $valeur, [Microsoft.Win32.RegistryValueKind]::$type)
  $k.Close()
}
function Reg-Delete($chemin) {
  if ($Simuler) { Write-Host "   [simulation] suppression de HKCU\$chemin"; return }
  [Microsoft.Win32.Registry]::CurrentUser.DeleteSubKeyTree($chemin, $false)
}
function Notifier-Explorateur {
  if ($Simuler) { return }
  Add-Type -Namespace Win32 -Name Shell -MemberDefinition '[System.Runtime.InteropServices.DllImport("shell32.dll")] public static extern void SHChangeNotify(int e, uint f, IntPtr a, IntPtr b);'
  [Win32.Shell]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero) # SHCNE_ASSOCCHANGED
}

if ($Desinstaller) {
  Write-Host "Désinstallation du lanceur $nom..."
  Reg-Delete "Software\Classes\$progId"
  Reg-Delete "Software\Classes\Applications\PDFEditOrLauncher.exe"
  Reg-Delete "Software\$appKey"
  if (-not $Simuler) {
    $ra = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Software\RegisteredApplications', $true)
    if ($ra) { $ra.DeleteValue($appKey, $false); $ra.Close() }
  }
  foreach ($e in $extensions) {
    if ($Simuler) { Write-Host "   [simulation] retrait de $progId dans $e\OpenWithProgids"; continue }
    $k = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey("Software\Classes\$e\OpenWithProgids", $true)
    if ($k) { $k.DeleteValue($progId, $false); $k.Close() }
  }
  if (-not $Simuler -and (Test-Path $Dossier)) { Remove-Item -Recurse -Force $Dossier }
  Notifier-Explorateur
  Write-Host 'Terminé. (Si un type de fichier était réglé sur ce lanceur, Windows reprendra son programme habituel.)'
  return
}

Write-Host "Installation du lanceur $nom dans $Dossier"
# 1. Compilation avec le compilateur fourni par Windows (.NET Framework 4)
$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path $csc)) { $csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe' }
if (-not (Test-Path $csc)) { throw "Compilateur .NET Framework 4 introuvable ($csc). Activez .NET Framework 4.x dans les fonctionnalités Windows." }
New-Item -ItemType Directory -Force -Path $Dossier | Out-Null
$icone = Join-Path $ici 'icone.ico'
$args = @('/nologo', '/target:winexe', '/optimize+', "/out:$exe", '/reference:System.Windows.Forms.dll', '/reference:System.Drawing.dll')
if (Test-Path $icone) { $args += "/win32icon:$icone"; Copy-Item $icone (Join-Path $Dossier 'icone.ico') -Force }
$args += (Join-Path $ici 'PDFEditOrLauncher.cs')
& $csc @args
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $exe)) { throw 'La compilation du lanceur a échoué.' }
# 2. Réglages : on garde ceux qui existent déjà
$ini = Join-Path $Dossier 'lanceur.ini'
if (-not (Test-Path $ini)) { Copy-Item (Join-Path $ici 'lanceur.ini') $ini }

# 3. Registre (utilisateur courant seulement) : le lanceur apparaît dans « Ouvrir avec » et dans Paramètres > Applications par défaut
$commande = "`"$exe`" `"%1`""
Reg-Set "Software\Classes\$progId" '' "Fichier ouvert dans $nom"
Reg-Set "Software\Classes\$progId\DefaultIcon" '' "`"$exe`",0"
Reg-Set "Software\Classes\$progId\shell\open\command" '' $commande
Reg-Set "Software\Classes\Applications\PDFEditOrLauncher.exe" 'FriendlyAppName' $nom
Reg-Set "Software\Classes\Applications\PDFEditOrLauncher.exe\shell\open\command" '' $commande
Reg-Set "Software\$appKey\Capabilities" 'ApplicationName' $nom
Reg-Set "Software\$appKey\Capabilities" 'ApplicationDescription' 'Ouvre les PDF et les images dans PDFEdit Or (version web)'
foreach ($e in $extensions) {
  Reg-Set "Software\Classes\Applications\PDFEditOrLauncher.exe\SupportedTypes" $e ''
  Reg-Set "Software\$appKey\Capabilities\FileAssociations" $e $progId
  Reg-Set "Software\Classes\$e\OpenWithProgids" $progId ([byte[]]@()) 'None'
}
Reg-Set 'Software\RegisteredApplications' $appKey "Software\$appKey\Capabilities"
Notifier-Explorateur

Write-Host ''
Write-Host 'Installation terminée.' -ForegroundColor Green
if (-not $Simuler) {
  Write-Host 'Dernière étape (une seule fois) : choisir ce lanceur comme application par défaut.'
  Write-Host '  - Clic droit sur un PDF > Ouvrir avec > Choisir une autre application > PDFEdit Or (web) > cocher « Toujours utiliser cette application » > OK'
  Write-Host '  - ou Paramètres Windows > Applications > Applications par défaut > PDFEdit Or (web) (je vous ouvre cette page).'
  Start-Process 'ms-settings:defaultapps'
}
