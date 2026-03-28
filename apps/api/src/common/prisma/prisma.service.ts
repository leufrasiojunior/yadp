import { Inject, Injectable, type OnApplicationShutdown, type OnModuleInit } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";

import { AppEnvService } from "../../config/app-env";
import { type Prisma, PrismaClient } from "./prisma-client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnApplicationShutdown {
  private readonly env: AppEnvService;

  constructor(@Inject(AppEnvService) env: AppEnvService) {
    const adapter = new PrismaPg({
      connectionString: env.values.DATABASE_URL,
    });
    const clientOptions: Prisma.PrismaClientOptions = {
      adapter,
      errorFormat: env.isProduction ? "minimal" : "pretty",
    };

    super(clientOptions);
    this.env = env;
  }

  async onModuleInit() {
    if (this.env.values.SKIP_DB_CONNECT) {
      return;
    }

    await this.$connect();
  }

  async onApplicationShutdown() {
    if (this.env.values.SKIP_DB_CONNECT) {
      return;
    }

    await this.$disconnect();
  }
}
