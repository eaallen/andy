/**
 * Known terminals per component type (mirrors frontend component factories).
 * Used to validate AI-generated YAML before returning it to clients.
 */
export const TERMINALS_BY_TYPE: Record<string, readonly string[]> = {
  power: ["l1", "n", "g"], // + l2… when legs > 1
  transformer: ["pri-l1", "pri-n", "pri-g", "sec-hot", "sec-com"],
  chime: ["front", "trans", "rear"],
  "terminal-block": ["l1", "n", "g", "com", "sig-f", "sig-r", "sig-s"],
  terminalBlock: ["l1", "n", "g", "com", "sig-f", "sig-r", "sig-s"],
  button: ["com", "sig"],
  switch: ["com", "no"],
  "three-way": ["t1", "com", "t2"],
  threeWay: ["t1", "com", "t2"],
  "four-way": ["a1", "a2", "b1", "b2"],
  fourWay: ["a1", "a2", "b1", "b2"],
  lamp: ["hot", "n"],
  receptacle: ["hot", "n", "g"],
  gfci: ["line-hot", "line-n", "line-g", "load-hot", "load-n", "load-g"],
};

export const KNOWN_TYPES = new Set(Object.keys(TERMINALS_BY_TYPE));

export const WIRE_COLORS = new Set(["red", "gray", "blue", "green"]);

export function terminalsForComponent(
  type: string,
  legs?: number,
): readonly string[] {
  if (type === "power") {
    const count = Math.max(1, Number(legs) || 1);
    const hots = Array.from({ length: count }, (_, i) => `l${i + 1}`);
    return [...hots, "n", "g"];
  }
  return TERMINALS_BY_TYPE[type] ?? [];
}
