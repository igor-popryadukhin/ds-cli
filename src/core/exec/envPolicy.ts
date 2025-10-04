export interface EnvPolicyOptions {
  whitelist: string[];
}

export function buildEnv(allowed: string[], source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const result: NodeJS.ProcessEnv = {};
  for (const key of allowed) {
    if (key in source) {
      result[key] = source[key];
    }
  }
  return result;
}

export function filterEnv(policy: EnvPolicyOptions, source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return buildEnv(policy.whitelist, source);
}
