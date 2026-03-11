export function buildNpmSpawnSpec(scriptName, platform = process.platform) {
  if (platform === "win32") {
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", `npm run ${scriptName}`],
      options: {
        stdio: "inherit",
      },
    };
  }

  return {
    command: "npm",
    args: ["run", scriptName],
    options: {
      stdio: "inherit",
    },
  };
}