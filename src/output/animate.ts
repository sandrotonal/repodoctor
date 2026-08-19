import chalk from "chalk";

const FRAMES = ["|", "/", "-", "\\"];

export interface ScanAnimationHandle {
  progress(label: string): void;
  finish(): void;
  abort(): void;
}

export function createScanAnimation(): ScanAnimationHandle | null {
  if (!process.stderr.isTTY) {
    return null;
  }

  let index = 0;
  let label = "Starting scan";

  const hideCursor = "\x1b[?25l";
  const showCursor = "\x1b[?25h";
  const clearLine = "\r\x1b[K";

  process.stderr.write(hideCursor);
  process.once("exit", () => {
    process.stderr.write(showCursor);
  });

  const render = (): void => {
    const frame = FRAMES[index % FRAMES.length];
    index += 1;
    process.stderr.write(`${clearLine} ${chalk.cyan(frame)} ${label}`);
  };

  const timer = setInterval(render, 90);
  timer.unref();
  render();

  const stop = (): void => {
    clearInterval(timer);
    process.stderr.write(clearLine);
    process.stderr.write(showCursor);
  };

  return {
    progress(nextLabel: string) {
      label = nextLabel;
      render();
    },
    finish() {
      stop();
    },
    abort() {
      stop();
    },
  };
}