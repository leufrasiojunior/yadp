import { Global, Module } from "@nestjs/common";

import { AppEnvService } from "./app-env";

@Global()
@Module({
  providers: [AppEnvService],
  exports: [AppEnvService],
})
export class AppEnvModule {}
