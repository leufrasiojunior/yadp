import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsIn, IsNumber, IsString, MaxLength, Min } from "class-validator";

import {
  DEFAULT_LISTS_PAGE_SIZE,
  DEFAULT_LISTS_SORT_DIRECTION,
  DEFAULT_LISTS_SORT_FIELD,
  LIST_SORT_DIRECTIONS,
  LIST_SORT_FIELDS,
  type ListSortDirection,
  type ListSortField,
  MAX_LISTS_PAGE,
  MAX_LISTS_PAGE_SIZE,
} from "../lists.types";

function clampInteger(value: unknown, minimum: number, maximum: number, fallback: number) {
  const parsed = typeof value === "string" && value.trim().length === 0 ? Number.NaN : Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(minimum, Math.min(maximum, Math.floor(parsed)));
}

function normalizeSortField(value: unknown): ListSortField {
  return typeof value === "string" && LIST_SORT_FIELDS.includes(value as ListSortField)
    ? (value as ListSortField)
    : DEFAULT_LISTS_SORT_FIELD;
}

function normalizeSortDirection(value: unknown): ListSortDirection {
  return typeof value === "string" && LIST_SORT_DIRECTIONS.includes(value as ListSortDirection)
    ? (value as ListSortDirection)
    : DEFAULT_LISTS_SORT_DIRECTION;
}

function normalizeSearch(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export class GetListsDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @Transform(({ value }) => clampInteger(value, 1, MAX_LISTS_PAGE, 1))
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ example: DEFAULT_LISTS_PAGE_SIZE, default: DEFAULT_LISTS_PAGE_SIZE })
  @Transform(({ value }) => clampInteger(value, 1, MAX_LISTS_PAGE_SIZE, DEFAULT_LISTS_PAGE_SIZE))
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  pageSize = DEFAULT_LISTS_PAGE_SIZE;

  @ApiPropertyOptional({
    example: DEFAULT_LISTS_SORT_FIELD,
    default: DEFAULT_LISTS_SORT_FIELD,
    enum: [...LIST_SORT_FIELDS],
  })
  @Transform(({ value }) => normalizeSortField(value))
  @IsIn(LIST_SORT_FIELDS)
  sortBy: ListSortField = DEFAULT_LISTS_SORT_FIELD;

  @ApiPropertyOptional({
    example: DEFAULT_LISTS_SORT_DIRECTION,
    default: DEFAULT_LISTS_SORT_DIRECTION,
    enum: [...LIST_SORT_DIRECTIONS],
  })
  @Transform(({ value }) => normalizeSortDirection(value))
  @IsIn(LIST_SORT_DIRECTIONS)
  sortDirection: ListSortDirection = DEFAULT_LISTS_SORT_DIRECTION;

  @ApiPropertyOptional({ example: "StevenBlack" })
  @Transform(({ value }) => normalizeSearch(value))
  @IsString()
  @MaxLength(500)
  search = "";
}
