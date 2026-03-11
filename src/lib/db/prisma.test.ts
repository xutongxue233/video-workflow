import { describe, expect, it } from "vitest";

import { prisma } from "./prisma";

describe("prisma client module", () => {
  it("exports a prisma client singleton", () => {
    expect(prisma).toBeDefined();
    expect(typeof prisma).toBe("object");
  });
});
