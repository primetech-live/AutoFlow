const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const sourceIcon = path.resolve(__dirname, '../build/icon.png');
const appxDir = path.resolve(__dirname, '../build/appx');

if (!fs.existsSync(appxDir)) {
    fs.mkdirSync(appxDir, { recursive: true });
}

const psScript = `
Add-Type -AssemblyName System.Drawing
$srcImg = [System.Drawing.Image]::FromFile('${sourceIcon.replace(/\\/g, '\\\\')}')

function Resize-Image($w, $h, $dest, $bgR, $bgG, $bgB, $bgA, $iconW, $iconH) {
    $bmp = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    if ($bgA -gt 0) {
        $g.Clear([System.Drawing.Color]::FromArgb($bgA, $bgR, $bgG, $bgB))
    } else {
        $g.Clear([System.Drawing.Color]::Transparent)
    }

    $offsetX = [int](($w - $iconW) / 2)
    $offsetY = [int](($h - $iconH) / 2)
    $g.DrawImage($srcImg, $offsetX, $offsetY, $iconW, $iconH)
    $bmp.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
}

$outDir = '${appxDir.replace(/\\/g, '\\\\')}'

Resize-Image 44 44 (Join-Path $outDir 'Square44x44Logo.png') 0 0 0 0 44 44
Resize-Image 150 150 (Join-Path $outDir 'Square150x150Logo.png') 0 0 0 0 150 150
Resize-Image 310 310 (Join-Path $outDir 'LargeTile.png') 0 0 0 0 310 310
Resize-Image 50 50 (Join-Path $outDir 'StoreLogo.png') 0 0 0 0 50 50
Resize-Image 310 150 (Join-Path $outDir 'Wide310x150Logo.png') 20 20 22 255 130 130

$srcImg.Dispose()
Write-Host 'Generated all AppX assets.'
`;

const tempScriptPath = path.resolve(__dirname, 'generate-appx-assets.ps1');
fs.writeFileSync(tempScriptPath, psScript, 'utf8');

try {
    const output = execSync(`powershell -ExecutionPolicy Bypass -File "${tempScriptPath}"`, { encoding: 'utf8' });
    console.log(output);
} finally {
    try { fs.unlinkSync(tempScriptPath); } catch {}
}
