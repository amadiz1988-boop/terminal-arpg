# CANONICAL_PROCDUMP_MAP_CRASH_SIDECAR_V1

Status: validated 2026-09-23 against installed ProcDump 12.01 on a temporary `pwsh.exe` process. This is a sidecar attachment to an already running canonical map-server. It does not launch a game server.

## Tool identity

```text
Path: C:\Users\Administrator\AppData\Local\Microsoft\Sysinternals\ProcDump-12.01\procdump64.exe
Product version: 12.01
SHA256: D1FC99AE304BD1D2BF28ABEB62531DA959E2431916194981B88C958FD713A8E6
```

Verify the file hash and version before attachment. Use a dedicated dump directory under `C:\Users\Administrator\ghost-island-production\ro-stack\.local\ro-stack\crash-capture`. Keep dumps and logs outside Git.

## Exact capture arguments

Replace `<MAP_PID>` with the current PID holding the sole canonical 5122 listener. Replace `<DUMP_DIR>` with the dedicated absolute dump directory. Pass each item below as a separate argument, except the ten filters, which form **one** comma-separated argument after `-f`:

```text
"C:\Users\Administrator\AppData\Local\Microsoft\Sysinternals\ProcDump-12.01\procdump64.exe" -ma -n 2 -e 1 -f "*C0000005*,*C000008D*,*C000008E*,*C000008F*,*C0000090*,*C0000091*,*C0000092*,*C0000093*,*C0000094*,*C0000095*" <MAP_PID> "<DUMP_DIR>"
```

`-ma` requests a full dump. `-e 1` captures first-chance and unhandled exceptions. `-n 2` bounds the capture count. The include filters retain exactly these exception codes: `C0000005`, `C000008D`, `C000008E`, `C000008F`, `C0000090`, `C0000091`, `C0000092`, `C0000093`, `C0000094`, `C0000095`. The surrounding `*` match the code within the exception text; they do not substitute for any code digits. Do not replace the list with a broad prefix.

On Windows, launch the sidecar with `Start-Process -WindowStyle Hidden`, redirecting standard output and error to files in the diagnostic directory. Before attachment, verify the map executable's canonical path and hash, one listener on 5122, health, and OpenKore count zero. After attachment, verify ProcDump's output lists all ten filters and the intended PID and dump folder; then verify the map process, one 5122 listener, health, and unchanged login/char PIDs. When the canonical map PID changes during a controlled restart, attach a new sidecar to the replacement PID.

## Graceful cancellation

```text
"C:\Users\Administrator\AppData\Local\Microsoft\Sysinternals\ProcDump-12.01\procdump64.exe" -cancel <MAP_PID>
```

Verify that ProcDump exits while the target process stays alive; then verify one 5122 listener and Dashboard health. Microsoft documents `-cancel <Target Process PID>` as the graceful cancellation signal, including resumption if a capture is in progress.

## Validation evidence

The installed `procdump64.exe -? -e` help and [Microsoft ProcDump documentation](https://learn.microsoft.com/en-us/sysinternals/downloads/procdump) specify `-ma`, `-e 1`, `-f <Include_Filter>, ...`, PID and dump-folder positional arguments, and `-cancel <PID>`. On 2026-09-23, a temporary local `pwsh.exe` PID 14328 accepted the exact argument layout above. ProcDump reported `First Chance+Unhandled`, all ten separate include filters, two maximum dumps, and the temporary dump folder. `-cancel 14328` ended ProcDump, left the test process alive, and produced no dump. The test process was then stopped. This validates argument parsing, attachment, and cancellation; natural crash capture was not exercised.
