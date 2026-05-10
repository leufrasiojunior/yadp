import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type { Request, Response } from "express";

import { PrismaService } from "../common/prisma/prisma.service";
import { AppEnvService } from "../config/app-env";
import { PRODUCT_TOUR_BROWSER_COOKIE_NAME, PRODUCT_TOUR_KEYS, type ProductTourKey } from "./tours.constants";
import { createHash, randomBytes } from "node:crypto";

const PRODUCT_TOUR_BROWSER_COOKIE_MAX_AGE_MS = 400 * 24 * 60 * 60 * 1000;

export type ProductTourStatusResponse = {
  tourKey: ProductTourKey;
  completed: boolean;
  completedAt: string | null;
};

@Injectable()
export class ToursService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AppEnvService) private readonly env: AppEnvService,
  ) {}

  async getStatus(tourKey: string, request: Request): Promise<ProductTourStatusResponse> {
    const knownTourKey = this.requireKnownTourKey(tourKey);
    const browserId = this.readBrowserIdCookie(request);

    if (!browserId) {
      return this.buildStatusResponse(knownTourKey, null);
    }

    const completion = await this.prisma.productTourCompletion.findUnique({
      where: {
        browserIdHash_tourKey: {
          browserIdHash: this.hashBrowserId(browserId),
          tourKey: knownTourKey,
        },
      },
    });

    return this.buildStatusResponse(knownTourKey, completion?.completedAt ?? null);
  }

  async complete(tourKey: string, request: Request, response: Response): Promise<ProductTourStatusResponse> {
    const knownTourKey = this.requireKnownTourKey(tourKey);
    const existingBrowserId = this.readBrowserIdCookie(request);
    const browserId = existingBrowserId ?? this.createBrowserId();

    if (!existingBrowserId) {
      this.writeBrowserIdCookie(response, browserId);
    }

    const completion = await this.prisma.productTourCompletion.upsert({
      where: {
        browserIdHash_tourKey: {
          browserIdHash: this.hashBrowserId(browserId),
          tourKey: knownTourKey,
        },
      },
      create: {
        browserIdHash: this.hashBrowserId(browserId),
        tourKey: knownTourKey,
      },
      update: {},
    });

    return this.buildStatusResponse(knownTourKey, completion.completedAt);
  }

  private requireKnownTourKey(tourKey: string): ProductTourKey {
    if (PRODUCT_TOUR_KEYS.includes(tourKey as ProductTourKey)) {
      return tourKey as ProductTourKey;
    }

    throw new BadRequestException("Unknown product tour.");
  }

  private readBrowserIdCookie(request: Request) {
    const rawCookie = request.cookies?.[PRODUCT_TOUR_BROWSER_COOKIE_NAME];

    return typeof rawCookie === "string" && rawCookie.trim().length > 0 ? rawCookie : null;
  }

  private writeBrowserIdCookie(response: Response, browserId: string) {
    response.cookie(PRODUCT_TOUR_BROWSER_COOKIE_NAME, browserId, {
      httpOnly: true,
      secure: this.env.values.COOKIE_SECURE,
      sameSite: "strict",
      expires: new Date(Date.now() + PRODUCT_TOUR_BROWSER_COOKIE_MAX_AGE_MS),
      path: "/",
    });
  }

  private createBrowserId() {
    return randomBytes(32).toString("base64url");
  }

  private hashBrowserId(browserId: string) {
    return createHash("sha256").update(browserId).digest("hex");
  }

  private buildStatusResponse(tourKey: ProductTourKey, completedAt: Date | null): ProductTourStatusResponse {
    return {
      tourKey,
      completed: completedAt !== null,
      completedAt: completedAt?.toISOString() ?? null,
    };
  }
}
