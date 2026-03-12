# Bundled FFmpeg

This project ships a repository-bundled FFmpeg binary for local Windows render merge:

- `win32-x64/ffmpeg.exe`

The runtime command resolution order is:

1. `FFMPEG_PATH` from environment
2. Bundled binary under `vendor/ffmpeg/...`
3. `ffmpeg-static` package binary
4. System `ffmpeg` from `PATH`

Notes:

- Keep `ffmpeg.exe.LICENSE` and `ffmpeg.exe.README` in the same folder when updating the bundled binary.
- Current binary source and build metadata are documented in `win32-x64/ffmpeg.exe.README`.
