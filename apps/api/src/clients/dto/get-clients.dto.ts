import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsArray, IsIn, IsNumber, IsString, MaxLength, Min } from "class-validator";

import { MAX_CLIENT_TAG_LENGTH, normalizeClientTagQueryValue } from "../client-tags";
import {
  CLIENT_LIST_SORT_DIRECTIONS,
  CLIENT_LIST_SORT_FIELDS,
  type ClientListSortDirection,
  type ClientListSortField,
  DEFAULT_CLIENTS_PAGE_SIZE,
  DEFAULT_CLIENTS_SORT_DIRECTION,
  DEFAULT_CLIENTS_SORT_FIELD,
  MAX_CLIENTS_PAGE,
  MAX_CLIENTS_PAGE_SIZE,
} from "../clients.types";

function clampInteger(value: unknown, minimum: number, maximum: number, fallback: number) {
  const parsed = typeof value === "string" && value.trim().length === 0 ? Number.NaN : Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(minimum, Math.min(maximum, Math.floor(parsed)));
}

function normalizeSortField(value: unknown): ClientListSortField {
  return typeof value === "string" && CLIENT_LIST_SORT_FIELDS.includes(value as ClientListSortField)
    ? (value as ClientListSortField)
    : DEFAULT_CLIENTS_SORT_FIELD;
}

function normalizeSortDirection(value: unknown): ClientListSortDirection {
  return typeof value === "string" && CLIENT_LIST_SORT_DIRECTIONS.includes(value as ClientListSortDirection)
    ? (value as ClientListSortDirection)
    : DEFAULT_CLIENTS_SORT_DIRECTION;
}

function normalizeSearch(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export class GetClientsDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @Transform(({ value }) => clampInteger(value, 1, MAX_CLIENTS_PAGE, 1))
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ example: DEFAULT_CLIENTS_PAGE_SIZE, default: DEFAULT_CLIENTS_PAGE_SIZE })
  @Transform(({ value }) => clampInteger(value, 1, MAX_CLIENTS_PAGE_SIZE, DEFAULT_CLIENTS_PAGE_SIZE))
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  pageSize = DEFAULT_CLIENTS_PAGE_SIZE;

  @ApiPropertyOptional({
    example: DEFAULT_CLIENTS_SORT_FIELD,
    default: DEFAULT_CLIENTS_SORT_FIELD,
    enum: [...CLIENT_LIST_SORT_FIELDS],
  })
  @Transform(({ value }) => normalizeSortField(value))
  @IsIn(CLIENT_LIST_SORT_FIELDS)
  sortBy: ClientListSortField = DEFAULT_CLIENTS_SORT_FIELD;

  @ApiPropertyOptional({
    example: DEFAULT_CLIENTS_SORT_DIRECTION,
    default: DEFAULT_CLIENTS_SORT_DIRECTION,
    enum: [...CLIENT_LIST_SORT_DIRECTIONS],
  })
  @Transform(({ value }) => normalizeSortDirection(value))
  @IsIn(CLIENT_LIST_SORT_DIRECTIONS)
  sortDirection: ClientListSortDirection = DEFAULT_CLIENTS_SORT_DIRECTION;

  @ApiPropertyOptional({ example: "82:6D:06:2E:9D:DC" })
  @Transform(({ value }) => normalizeSearch(value))
  @IsString()
  @MaxLength(191)
  search = "";

  @ApiPropertyOptional({ example: ["IoT"], isArray: true, type: String })
  @Transform(({ value }) => normalizeClientTagQueryValue(value))
  @IsArray()
  @IsString({ each: true })
  @MaxLength(MAX_CLIENT_TAG_LENGTH, { each: true })
  excludedTags: string[] = [];
}
