import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsString } from "class-validator";

export class ListItemParamsDto {
  @ApiProperty({
    description: "Type of list",
    enum: ["allow", "block"],
    example: "block",
  })
  @IsEnum(["allow", "block"])
  type!: "allow" | "block";

  @ApiProperty({
    description: "Address of the list (URL encoded if needed)",
    example: "https%3A%2F%2Fraw.githubusercontent.com%2FStevenBlack%2Fhosts%2Fmaster%2Fhosts",
  })
  @IsString()
  address!: string;
}
