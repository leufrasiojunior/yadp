import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength } from "class-validator";

export class UndoExtensionBatchDto {
  @ApiProperty({ example: "clw-batch" })
  @IsString()
  batchId!: string;

  @ApiProperty({ example: "undo-token" })
  @IsString()
  @MaxLength(200)
  undoToken!: string;
}
