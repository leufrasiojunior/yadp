import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsArray, IsNumber, IsString, MaxLength, Min } from "class-validator";

import {
  DEFAULT_DOMAINS_PAGE_SIZE,
  DEFAULT_DOMAINS_SORT_DIRECTION,
  DEFAULT_DOMAINS_SORT_FIELD,
  DOMAIN_FILTER_VALUES,
  DOMAIN_SORT_DIRECTIONS,
  DOMAIN_SORT_FIELDS,
  type DomainFilterValue,
  type DomainSortDirection,
  type DomainSortField,
  MAX_DOMAINS_PAGE,
  MAX_DOMAINS_PAGE_SIZE,
} from "../domains.types";

function clampInteger(value: unknown, minimum: number, maximum: number, fallback: number) {
  const parsed = typeof value === "string" && value.trim().length === 0 ? Number.NaN : Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(minimum, Math.min(maximum, Math.floor(parsed)));
}

function normalizeSortField(value: unknown): DomainSortField {
  return typeof value === "string" && DOMAIN_SORT_FIELDS.includes(value as DomainSortField)
    ? (value as DomainSortField)
    : DEFAULT_DOMAINS_SORT_FIELD;
}

function normalizeSortDirection(value: unknown): DomainSortDirection {
  return typeof value === "string" && DOMAIN_SORT_DIRECTIONS.includes(value as DomainSortDirection)
    ? (value as DomainSortDirection)
    : DEFAULT_DOMAINS_SORT_DIRECTION;
}

function normalizeSearch(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeDomainFilters(value: unknown): DomainFilterValue[] {
  const source = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
  const normalized = source
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item): item is DomainFilterValue => DOMAIN_FILTER_VALUES.includes(item as DomainFilterValue));

  return [...new Set(normalized)];
}

export class GetDomainsDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @Transform(({ value }) => clampInteger(value, 1, MAX_DOMAINS_PAGE, 1))
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ example: DEFAULT_DOMAINS_PAGE_SIZE, default: DEFAULT_DOMAINS_PAGE_SIZE })
  @Transform(({ value }) => clampInteger(value, 1, MAX_DOMAINS_PAGE_SIZE, DEFAULT_DOMAINS_PAGE_SIZE))
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  pageSize = DEFAULT_DOMAINS_PAGE_SIZE;

  @ApiPropertyOptional({
    example: DEFAULT_DOMAINS_SORT_FIELD,
    default: DEFAULT_DOMAINS_SORT_FIELD,
    enum: [...DOMAIN_SORT_FIELDS],
  })
  @Transform(({ value }) => normalizeSortField(value))
  sortBy: DomainSortField = DEFAULT_DOMAINS_SORT_FIELD;

  @ApiPropertyOptional({
    example: DEFAULT_DOMAINS_SORT_DIRECTION,
    default: DEFAULT_DOMAINS_SORT_DIRECTION,
    enum: [...DOMAIN_SORT_DIRECTIONS],
  })
  @Transform(({ value }) => normalizeSortDirection(value))
  sortDirection: DomainSortDirection = DEFAULT_DOMAINS_SORT_DIRECTION;

  @ApiPropertyOptional({ example: "example.com" })
  @Transform(({ value }) => normalizeSearch(value))
  @IsString()
  @MaxLength(500)
  search = "";

  @ApiPropertyOptional({ example: ["exact-allow"], isArray: true, type: String })
  @Transform(({ value }) => normalizeDomainFilters(value))
  @IsArray()
  @IsString({ each: true })
  filters: DomainFilterValue[] = [...DOMAIN_FILTER_VALUES];
}
