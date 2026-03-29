export function isPrismaMissingModelTable(error: unknown, modelName: string) {
  if (!error || typeof error !== "object") {
    return false;
  }

  if (Reflect.get(error, "code") !== "P2021") {
    return false;
  }

  const meta = Reflect.get(error, "meta");

  if (!meta || typeof meta !== "object") {
    return false;
  }

  return Reflect.get(meta, "modelName") === modelName;
}
