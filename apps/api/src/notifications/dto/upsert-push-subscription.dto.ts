import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsOptional, IsString, MinLength, ValidateNested } from "class-validator";

class PushSubscriptionKeysDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  auth!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  p256dh!: string;
}

export class UpsertPushSubscriptionDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  endpoint!: string;

  @ApiProperty({ type: PushSubscriptionKeysDto })
  @ValidateNested()
  @Type(() => PushSubscriptionKeysDto)
  keys!: PushSubscriptionKeysDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userAgent?: string;
}
