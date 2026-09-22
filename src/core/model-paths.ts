// Write a dotted path onto reactive state (data-p-model's write-back half).

export const writePathOnState = (state: any, path: string, value: unknown): void => {
  const segments = path.split(".");
  const tail = segments.pop()!;
  let target = state;

  for (const segment of segments) {
    target = target?.[segment];
  }

  if (target != null) {
    target[tail] = value;
  }
};
