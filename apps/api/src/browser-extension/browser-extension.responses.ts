import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class BrowserExtensionSettingsResponse {
  @ApiProperty({ type: Boolean, example: false })
  sendPageTitle!: boolean;

  @ApiProperty({ type: [String] })
  hardBlockedUrlPatterns!: string[];

  @ApiProperty({ type: [String] })
  sensitiveUrlPatterns!: string[];
}

class BrowserExtensionRuleCacheItemResponse {
  @ApiProperty({ type: String, example: "ads.example.com" })
  target!: string;

  @ApiProperty({ type: String, enum: ["exact", "regex"], example: "exact" })
  kind!: "exact" | "regex";

  @ApiProperty({
    type: String,
    enum: ["browser_extension_decision", "managed_domain"],
    example: "managed_domain",
  })
  source!: "browser_extension_decision" | "managed_domain";
}

export class BrowserExtensionPairingCodeResponse {
  @ApiProperty({ type: String, example: "123456" })
  pairingCode!: string;

  @ApiProperty({ type: String, example: "2026-07-02T15:00:00.000Z" })
  expiresAt!: string;
}

export class BrowserExtensionPairResponse {
  @ApiProperty({ type: String, example: "token" })
  accessToken!: string;

  @ApiProperty({ type: String, example: "clw-extension" })
  extensionId!: string;

  @ApiProperty({ type: BrowserExtensionSettingsResponse })
  settings!: BrowserExtensionSettingsResponse;

  @ApiProperty({ type: [BrowserExtensionRuleCacheItemResponse] })
  allowlist!: BrowserExtensionRuleCacheItemResponse[];

  @ApiProperty({ type: [BrowserExtensionRuleCacheItemResponse] })
  blockedItems!: BrowserExtensionRuleCacheItemResponse[];
}

export class BrowserExtensionConfigResponseClass {
  @ApiProperty({ type: BrowserExtensionSettingsResponse })
  settings!: BrowserExtensionSettingsResponse;

  @ApiProperty({ type: [BrowserExtensionRuleCacheItemResponse] })
  allowlist!: BrowserExtensionRuleCacheItemResponse[];

  @ApiProperty({ type: [BrowserExtensionRuleCacheItemResponse] })
  blockedItems!: BrowserExtensionRuleCacheItemResponse[];
}

class BrowserExtensionApplyResultItemResponse {
  @ApiProperty({ type: String, example: "ads.example.com" })
  target!: string;

  @ApiProperty({ type: String, enum: ["deny"], example: "deny" })
  type!: "deny";

  @ApiProperty({ type: String, enum: ["exact", "regex"], example: "exact" })
  kind!: "exact" | "regex";

  @ApiProperty({ type: String, enum: ["applied", "skipped", "failed"], example: "applied" })
  status!: "applied" | "skipped" | "failed";

  @ApiPropertyOptional({ type: String, example: "Pi-hole rejected the domain." })
  errorMessage?: string;
}

class BrowserExtensionApplySummaryResponse {
  @ApiProperty({ type: Number, example: 2 })
  totalTargets!: number;

  @ApiProperty({ type: Number, example: 2 })
  appliedCount!: number;

  @ApiProperty({ type: Number, example: 0 })
  failedCount!: number;

  @ApiProperty({ type: Number, example: 0 })
  skippedCount!: number;
}

export class BrowserExtensionApplyResponse {
  @ApiProperty({ type: String, example: "clw-batch" })
  batchId!: string;

  @ApiProperty({ type: String, example: "undo-token" })
  undoToken!: string;

  @ApiProperty({ type: String, enum: ["applied", "partial", "failed"], example: "applied" })
  status!: "applied" | "partial" | "failed";

  @ApiProperty({ type: BrowserExtensionApplySummaryResponse })
  summary!: BrowserExtensionApplySummaryResponse;

  @ApiProperty({ type: [BrowserExtensionApplyResultItemResponse] })
  applied!: BrowserExtensionApplyResultItemResponse[];

  @ApiProperty({ type: [BrowserExtensionApplyResultItemResponse] })
  skipped!: BrowserExtensionApplyResultItemResponse[];

  @ApiProperty({ type: [BrowserExtensionApplyResultItemResponse] })
  failed!: BrowserExtensionApplyResultItemResponse[];
}

class BrowserExtensionReportSummaryResponse {
  @ApiProperty({ type: Number, example: 12 })
  totalTargets!: number;

  @ApiProperty({ type: Number, example: 9 })
  detectedCount!: number;

  @ApiProperty({ type: Number, example: 2 })
  blockedCount!: number;

  @ApiProperty({ type: Number, example: 1 })
  allowedCount!: number;
}

export class BrowserExtensionReportResponse {
  @ApiProperty({ type: String, example: "clw-batch" })
  batchId!: string;

  @ApiProperty({ type: String, enum: ["detected"], example: "detected" })
  status!: "detected";

  @ApiProperty({ type: BrowserExtensionReportSummaryResponse })
  summary!: BrowserExtensionReportSummaryResponse;
}

class BrowserExtensionUndoResultItemResponse {
  @ApiProperty({ type: String, example: "ads.example.com" })
  target!: string;

  @ApiProperty({ type: String, enum: ["deny"], example: "deny" })
  type!: "deny";

  @ApiProperty({ type: String, enum: ["exact", "regex"], example: "exact" })
  kind!: "exact" | "regex";

  @ApiPropertyOptional({ type: String, example: "Pi-hole rejected the removal." })
  errorMessage?: string;
}

class BrowserExtensionUndoSummaryResponse {
  @ApiProperty({ type: Number, example: 2 })
  totalTargets!: number;

  @ApiProperty({ type: Number, example: 2 })
  removedCount!: number;

  @ApiProperty({ type: Number, example: 0 })
  failedCount!: number;
}

export class BrowserExtensionUndoResponse {
  @ApiProperty({ type: String, example: "clw-batch" })
  batchId!: string;

  @ApiProperty({ type: String, enum: ["undone"], example: "undone" })
  status!: "undone";

  @ApiProperty({ type: BrowserExtensionUndoSummaryResponse })
  summary!: BrowserExtensionUndoSummaryResponse;

  @ApiProperty({ type: [BrowserExtensionUndoResultItemResponse] })
  removed!: BrowserExtensionUndoResultItemResponse[];

  @ApiProperty({ type: [BrowserExtensionUndoResultItemResponse] })
  failed!: BrowserExtensionUndoResultItemResponse[];
}

class BrowserExtensionDeviceResponse {
  @ApiProperty({ type: String, example: "clw-extension" })
  id!: string;

  @ApiProperty({ type: String, example: "YAPD Inspector" })
  name!: string;

  @ApiProperty({ type: String, example: "chrome-or-edge" })
  browser!: string;

  @ApiProperty({ type: Number, example: 3 })
  manifestVersion!: number;

  @ApiProperty({ type: String, example: "0.1.0" })
  extensionVersion!: string;

  @ApiProperty({ type: String, example: "abcd1234" })
  tokenPrefix!: string;

  @ApiProperty({ type: String, example: "2026-07-02T15:00:00.000Z", nullable: true })
  lastSeenAt!: string | null;

  @ApiProperty({ type: String, example: "2026-07-02T15:00:00.000Z", nullable: true })
  revokedAt!: string | null;

  @ApiProperty({ type: String, example: "2026-07-02T15:00:00.000Z" })
  createdAt!: string;
}

export class BrowserExtensionDevicesResponse {
  @ApiProperty({ type: [BrowserExtensionDeviceResponse] })
  items!: BrowserExtensionDeviceResponse[];
}

export class BrowserExtensionDeviceRevokeResponse {
  @ApiProperty({ type: String, example: "clw-extension" })
  id!: string;

  @ApiProperty({ type: String, example: "2026-07-02T15:00:00.000Z" })
  revokedAt!: string;
}

class BrowserExtensionDetectionItemResponse {
  @ApiProperty({ type: String, example: "clw-item" })
  id!: string;

  @ApiProperty({ type: String, example: "candidate-1" })
  candidateId!: string;

  @ApiProperty({ type: String, example: "ads.example.com" })
  target!: string;

  @ApiProperty({ type: String, example: "example.com" })
  targetMainDomain!: string;

  @ApiProperty({ type: String, enum: ["deny"], example: "deny" })
  type!: "deny";

  @ApiProperty({ type: String, enum: ["exact", "regex"], example: "exact" })
  kind!: "exact" | "regex";

  @ApiProperty({ type: String, example: "ads" })
  category!: string;

  @ApiProperty({ type: Number, example: 85 })
  score!: number;

  @ApiProperty({ type: String, example: "high" })
  riskLevel!: string;

  @ApiProperty({ type: [String] })
  reasons!: string[];

  @ApiProperty({ type: "object", additionalProperties: true })
  evidence!: Record<string, unknown>;

  @ApiProperty({ type: String, example: "applied" })
  applyStatus!: string;

  @ApiProperty({ type: String, nullable: true })
  errorMessage!: string | null;
}

class BrowserExtensionDetectionBatchResponse {
  @ApiProperty({ type: String, example: "clw-batch" })
  id!: string;

  @ApiProperty({ type: String, example: "clw-extension" })
  extensionId!: string;

  @ApiProperty({ type: String, example: "YAPD Inspector" })
  extensionName!: string;

  @ApiProperty({ type: String, example: "request-uuid" })
  clientRequestId!: string;

  @ApiProperty({ type: String, example: "example.com" })
  pageDomain!: string;

  @ApiProperty({ type: String, example: "example.com" })
  pageMainDomain!: string;

  @ApiProperty({ type: String, nullable: true })
  pageUrl!: string | null;

  @ApiProperty({ type: String, nullable: true })
  pageTitle!: string | null;

  @ApiProperty({ type: String, example: "applied" })
  status!: string;

  @ApiProperty({ type: "object", additionalProperties: true, nullable: true })
  summary!: Record<string, unknown> | null;

  @ApiProperty({ type: String, example: "2026-07-02T15:00:00.000Z" })
  createdAt!: string;

  @ApiProperty({ type: String, nullable: true })
  undoneAt!: string | null;

  @ApiProperty({ type: [BrowserExtensionDetectionItemResponse] })
  items!: BrowserExtensionDetectionItemResponse[];
}

class BrowserExtensionPaginationResponse {
  @ApiProperty({ type: Number, example: 1 })
  page!: number;

  @ApiProperty({ type: Number, example: 10 })
  pageSize!: number;

  @ApiProperty({ type: Number, example: 20 })
  totalItems!: number;

  @ApiProperty({ type: Number, example: 2 })
  totalPages!: number;
}

export class BrowserExtensionDetectionsResponse {
  @ApiProperty({ type: [BrowserExtensionDetectionBatchResponse] })
  items!: BrowserExtensionDetectionBatchResponse[];

  @ApiProperty({ type: BrowserExtensionPaginationResponse })
  pagination!: BrowserExtensionPaginationResponse;
}

class BrowserExtensionDomainDetectionItemResponse extends BrowserExtensionDetectionItemResponse {
  @ApiProperty({ type: String, example: "clw-batch" })
  batchId!: string;

  @ApiProperty({ type: String, example: "example.com" })
  pageDomain!: string;

  @ApiProperty({ type: String, nullable: true })
  pageUrl!: string | null;

  @ApiProperty({ type: String, nullable: true })
  pageTitle!: string | null;

  @ApiProperty({ type: String, example: "2026-07-02T15:00:00.000Z" })
  detectedAt!: string;
}

class BrowserExtensionTargetDomainGroupResponse {
  @ApiProperty({ type: String, example: "doubleclick.net" })
  targetMainDomain!: string;

  @ApiProperty({ type: Number, example: 4 })
  totalDetected!: number;

  @ApiProperty({ type: Number, example: 2 })
  blockedCount!: number;

  @ApiProperty({ type: Number, example: 2 })
  notBlockedCount!: number;

  @ApiProperty({ type: [BrowserExtensionDomainDetectionItemResponse] })
  items!: BrowserExtensionDomainDetectionItemResponse[];
}

class BrowserExtensionDomainDetectionGroupResponse {
  @ApiProperty({ type: String, example: "terra.com.br" })
  pageMainDomain!: string;

  @ApiProperty({ type: String, example: "terra.com.br" })
  latestPageDomain!: string;

  @ApiProperty({ type: String, nullable: true })
  latestPageUrl!: string | null;

  @ApiProperty({ type: String, nullable: true })
  latestPageTitle!: string | null;

  @ApiProperty({ type: String, example: "2026-07-02T15:00:00.000Z" })
  lastDetectedAt!: string;

  @ApiProperty({ type: Number, example: 20 })
  totalDetected!: number;

  @ApiProperty({ type: Number, example: 6 })
  blockedCount!: number;

  @ApiProperty({ type: Number, example: 14 })
  notBlockedCount!: number;

  @ApiProperty({ type: String, example: "partial" })
  status!: string;

  @ApiProperty({ type: [BrowserExtensionTargetDomainGroupResponse] })
  targetGroups!: BrowserExtensionTargetDomainGroupResponse[];
}

export class BrowserExtensionDomainDetectionsResponse {
  @ApiProperty({ type: [BrowserExtensionDomainDetectionGroupResponse] })
  items!: BrowserExtensionDomainDetectionGroupResponse[];

  @ApiProperty({ type: BrowserExtensionPaginationResponse })
  pagination!: BrowserExtensionPaginationResponse;
}
