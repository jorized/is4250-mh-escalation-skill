/** M10: one switch. Anything other than the literal "false" keeps test mode on. */
export const TEST_MODE = import.meta.env.VITE_TEST_MODE !== "false";

export const MODELS = [
  { id: "claude-opus-5-5", label: "Claude Opus 5.5" },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5" },
] as const;

export const DEFAULT_MODEL: string = import.meta.env.VITE_DEFAULT_MODEL ?? "claude-opus-5-5";

/**
 * Soft gate only. GitHub Pages is static, so this check runs in the browser and
 * can be bypassed by anyone who reads the bundle. It keeps casual visitors out;
 * it is not security. The real protection is that no API key ships in the bundle.
 */
export const GATE_SHA256 = "8ad154188f7d6acd10d68e59fb76f8e20f7eed596848f8871570ac7a8f971ed3";
