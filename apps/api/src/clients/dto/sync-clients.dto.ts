import { Transform } from "class-transformer";
import { ArrayMinSize, ArrayUnique, IsArray, IsOptional, IsString } from "class-validator";

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return value;
  }

  const normalized = [...new Set(value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean))];
  return normalized.length > 0 ? normalized : undefined;
}

export class SyncClientsDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @Transform(({ value }) => normalizeStringArray(value))
  @IsString({ each: true })
  targetInstanceIds?: string[];
}
