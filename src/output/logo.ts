import chalk from "chalk";
import { centerText, gradient, type RGB } from "./theme.js";

export const BRAND_START: RGB = [0, 196, 255];
export const BRAND_END: RGB = [255, 106, 255];

export const PULSE_WAVE = "▁▁▁▁▁▂▃▄▅▆▇█▇▆▅▄▃▂▁▁▁▁▁▁▂▃▄▅▆▇█▇▆▅▄▃▁▁▁▁▁";

export const WORDMARK = "R E P O D O C T O R";

export function renderLogo(inner: number): string[] {
  return [
    centerText(gradient(PULSE_WAVE, BRAND_START, BRAND_END), inner),
    "",
    centerText(gradient(WORDMARK, BRAND_START, BRAND_END), inner),
    centerText(chalk.dim(` ${WORDMARK}`), inner),
    "",
    centerText(chalk.dim("Diagnose before you waste time debugging it."), inner),
  ];
}