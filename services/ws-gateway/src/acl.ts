export function compileWhitelist(patterns: string[]): RegExp[] {
  // Convert NATS-style wildcard to RegExp: * (token), > (any suffix)
  // For simplicity: treat '*' as '[^.]+', '>' as '.*'
  return patterns.map((p) => {
    const escaped = p.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    const re = '^' + escaped.replace(/\*/g, '[^.]+').replace(/>/g, '.*') + '$';
    return new RegExp(re);
  });
}

export function isSubjectAllowed(subject: string, allow: RegExp[]): boolean {
  return allow.some((re) => re.test(subject));
}

