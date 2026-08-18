const fs = require('fs');
const path = require('path');

function copyFile(src, dest) {
    if (!fs.existsSync(src)) {
        console.log(`Skipping copy: ${src} does not exist yet.`);
        return;
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    console.log(`Copied ${src} -> ${dest}`);
}

try {
    // Copy icon to output dist directory if present
    copyFile('src/renderer/assets/icon-1.png', 'dist/renderer/assets/icon-1.png');

    // Ensure standalone binary is named autoflow.exe
    if (fs.existsSync('dist/bin/cli-win.exe')) {
        copyFile('dist/bin/cli-win.exe', 'dist/bin/autoflow.exe');
    }
    console.log("✅ Asset copy complete!");
} catch (e) {
    console.error("❌ Error copying assets:", e.message);
    process.exit(1);
}
