import { app, BrowserWindow, shell } from "electron";
import { join } from "node:path";
import { rmSync } from "node:fs";
import { loadEnv } from "./env";
import { registerIpc } from "./ipc";
import { runSmoke } from "./smoke";
import { logger } from "../../../lib/logger";

loadEnv(process.cwd());

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 980,
    minHeight: 640,
    show: false,
    frame: false,
    backgroundColor: "#faf9f6",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.once("ready-to-show", () => win.show());

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void win.loadFile(join(__dirname, "../renderer/index.html"));
  }
  return win;
}

const isSmoke = process.argv.includes("--smoke");

app.whenReady().then(async () => {
  registerIpc();
  if (isSmoke) {
    process.env.TURSO_URL = "";
    process.env.OGT_DATA_DIR = process.env.OGT_SMOKE_DIR ?? join(app.getPath("temp"), "ogt-smoke");
    rmSync(process.env.OGT_DATA_DIR, { recursive: true, force: true });
    console.log(`[smoke] start (turso=${process.env.TURSO_URL || "off"}, data=${process.env.OGT_DATA_DIR})`);
    const ok = await runSmoke();
    console.log(`[smoke] ${ok ? "PASS" : "FAIL"}`);
    await new Promise((r) => setTimeout(r, 500));
    app.exit(ok ? 0 : 1);
    return;
  }
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

process.on("uncaughtException", (err) => {
  logger.error("uncaught exception", { error: String(err) });
});
