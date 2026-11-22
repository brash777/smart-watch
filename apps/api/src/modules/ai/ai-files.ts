/*
 * Folders that ship with the AI module. The build copies them next to the bundle
 * (tsup.config.ts), so these paths work both from the sources and from dist/.
 */

/** Versioned prompt templates: <name>.v<N>.md. */
export const PROMPTS_DIRECTORY = new URL('./prompts/', import.meta.url);

/** MockAiProvider answers: <prompt name>.json. */
export const FIXTURES_DIRECTORY = new URL('./fixtures/', import.meta.url);
