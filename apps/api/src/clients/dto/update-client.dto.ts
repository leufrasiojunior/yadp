import { Transform, Type } from "class-transformer";
import { IsArray, IsNumber, IsOptional } from "class-validator";

function normalizeNumberArrayAllowEmpty(value: unknown) {
  if (!Array.isArray(value)) {
    return value;
  }

  return [...new Set(value.map((item) => Number(item)).filter((item) => Number.isFinite(item)))];
}

export class UpdateClientDto {
  @IsOptional()
  @IsArray()
  @Transform(({ value }) => normalizeNumberArrayAllowEmpty(value))
  @Type(() => Number)
  @IsNumber({}, { each: true })
  groups?: number[];
}
