import { IsIn } from "class-validator";

import { PRODUCT_TOUR_KEYS } from "../tours.constants";

export class ProductTourKeyParamsDto {
  @IsIn(PRODUCT_TOUR_KEYS)
  tourKey!: string;
}
