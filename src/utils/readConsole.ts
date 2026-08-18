import fs from 'fs';
import readline from 'readline';

export async function readConsole(promptText: string, isPassword = false): Promise<string> {
    return new Promise<string>((resolve) => {
        if (promptText) {
            process.stdout.write(promptText + ' ');
        }

        // Standard interactive TTY mode
        if (process.stdin.isTTY) {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            if (isPassword) {
                // Mask password output in interactive TTY mode
                (rl as any)._writeToOutput = (stringToWrite: string) => {
                    if ((rl as any).line) {
                        process.stdout.write('*');
                    }
                };
            }

            rl.question('', (answer: string) => {
                rl.close();
                resolve(answer.trim());
            });
            return;
        }

        // Native Console Device fallback for packaged Electron CLI (ELECTRON_RUN_AS_NODE=1)
        try {
            let inputStr = '';
            if (process.platform === 'win32') {
                // Windows native console handle
                const fd = fs.openSync('\\\\.\\CON', 'rs');
                const buf = Buffer.alloc(512);
                const bytesRead = fs.readSync(fd, buf, 0, 512, null);
                fs.closeSync(fd);
                inputStr = buf.toString('utf8', 0, bytesRead).replace(/[\r\n]+/g, '').trim();
            } else {
                // Linux / macOS TTY device
                const fd = fs.openSync('/dev/tty', 'rs');
                const buf = Buffer.alloc(512);
                const bytesRead = fs.readSync(fd, buf, 0, 512, null);
                fs.closeSync(fd);
                inputStr = buf.toString('utf8', 0, bytesRead).replace(/[\r\n]+/g, '').trim();
            }
            resolve(inputStr);
        } catch (e) {
            console.error('\n\x1b[31m[Error] Cannot read from console. Please run from a standard terminal.\x1b[0m');
            resolve('');
        }
    });
}
