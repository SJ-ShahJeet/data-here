import { loadConfig, type ConfigValue } from "@/lib/mg-config";

export interface Settings {
  profile: string;
  track: string;
  config: Record<string, ConfigValue>;
  env_overrides: Record<string, string>;
}

export function settings(root: string): Settings {
  const cfg = loadConfig(root);
  const profile = String(cfg.profile ?? "standard");
  const track = String(cfg.track ?? "auto");

  // Collect MEMORY_* env vars, sorted by key
  const env_overrides: Record<string, string> = {};
  const envKeys = Object.keys(process.env)
    .filter((key) => key.startsWith("MEMORY_"))
    .sort();

  for (const key of envKeys) {
    env_overrides[key] = String(process.env[key]);
  }

  return {
    profile,
    track,
    config: cfg,
    env_overrides,
  };
}
