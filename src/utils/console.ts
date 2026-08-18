import readline from 'readline';
import fs from 'fs';

export async function promptConsole(promptText: string, isPassword = false): Promise<string> {
    return new Promise<string>((resolve) => {
        process.stdout.write(promptText);

        // 1. Normal TTY Terminal Environment
        if (process.stdin.isTTY) {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
            
            rl.question('', (answer: string) => {
                rl.close();
                resolve(answer.trim());
            });
            return;
        }

        // 2. Fallback for packaged Electron binary (ELECTRON_RUN_AS_NODE=1) where stdin is detached
        try {
            let inputStr = '';
            if (process.platform === 'win32') {
                // Windows-only CON console device
                const fd = fs.openSync('\\\\.\\CON', 'rs');
                const buf = Buffer.alloc(512);
                const bytesRead = fs.readSync(fd, buf, 0, 512, null);
                fs.closeSync(fd);
                inputStr = buf.toString('utf8', 0, bytesRead).trim();
            } else {
                // macOS / Linux: /dev/tty console device
                const fd = fs.openSync('/dev/tty', 'rs');
                const buf = Buffer.alloc(512);
                const bytesRead = fs.readSync(fd, buf, 0, 512, null);
                fs.closeSync(fd);
                inputStr = buf.toString('utf8', 0, bytesRead).trim();
            }
            console.log('');
            resolve(inputStr);
        } catch (e) {
            console.error('\n\x1b[31m[Error] Cannot read from console device. Please run from a standard terminal.\x1b[0m');
            process.exit(1);
        }
    });
}
