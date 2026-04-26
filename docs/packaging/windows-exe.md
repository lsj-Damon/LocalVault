# Windows EXE Packaging

Use this command from the project root:

```powershell
npm run dist
```

The command calls `scripts/package-win.ps1`, which:

1. Stops any running `release\win-unpacked\Local Vault.exe` process so old DLLs do not lock the output directory.
2. Clears `DEBUG` and `ELECTRON_RUN_AS_NODE`, which can add noisy child-process output in this local shell.
3. Runs `npm.cmd run build`.
4. Finds the local electron-builder NSIS caches and sets:
   - `ELECTRON_BUILDER_NSIS_DIR`
   - `ELECTRON_BUILDER_NSIS_RESOURCES_DIR`
5. Runs `node_modules\.bin\electron-builder.cmd --win --publish never`.

Output files are written to `release/`. The installer is named like:

```text
release/Local Vault-0.1.0-x64.exe
```

## Why This Script Exists

The plain command `npm run build && electron-builder --win` can fail in this environment for two reasons:

- If the previous packaged app is still running, electron-builder cannot clear `release\win-unpacked` and can fail with `Access is denied` on files such as `d3dcompiler_47.dll`.
- The local `app-builder.exe` may print `[0x...] ANOMALY: use of REX.w is meaningless (default operand size is 64)`. When electron-builder asks app-builder for NSIS cache paths, that extra line can be appended to paths such as `elevate.exe` or the NSIS plugin directory. Setting the NSIS cache directories explicitly avoids that parsing failure.

If the NSIS cache is missing, the script lets electron-builder download it and retries. A network connection may be needed on the first run.

## Manual Recovery

If packaging still fails after three attempts, check these items:

```powershell
Get-Process -Name "Local Vault" -ErrorAction SilentlyContinue
Get-ChildItem "$env:LOCALAPPDATA\electron-builder\Cache\nsis"
npm run build
npm run dist
```

The warning `author is missed in the package.json` is not fatal. The default Electron icon warning is also not fatal unless a custom app icon is required.
