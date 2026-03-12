import type { PrismaClient } from "@prisma/client";

import { z } from "zod";

import { prisma as defaultPrisma } from "../db/prisma";
import { ensureWorkflowProjectExists } from "../projects/workflow-project";

type ScriptRecord = {
  id: string;
  projectId: string;
  title: string | null;
  hook: string | null;
  sellingPoints: string | null;
  storyboard: string | null;
  structuredJson: string | null;
  cta: string | null;
};

type CreateScriptInput = {
  projectId: string;
  title?: string;
  hook?: string;
  sellingPoints?: string;
  storyboard?: string;
  structuredJson?: string;
  cta?: string;
};

type UpdateScriptInput = {
  title?: string;
  hook?: string;
  sellingPoints?: string;
  storyboard?: string;
  structuredJson?: string;
  cta?: string;
};

type ScriptRepository = {
  createScript(input: CreateScriptInput): Promise<ScriptRecord>;
  updateScript(scriptId: string, input: UpdateScriptInput): Promise<ScriptRecord>;
  findById(scriptId: string): Promise<ScriptRecord | null>;
};

const createSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().optional(),
  hook: z.string().optional(),
  sellingPoints: z.string().optional(),
  storyboard: z.string().optional(),
  structuredJson: z.string().optional(),
  cta: z.string().optional(),
});

const updateSchema = z
  .object({
    title: z.string().optional(),
    hook: z.string().optional(),
    sellingPoints: z.string().optional(),
    storyboard: z.string().optional(),
    structuredJson: z.string().optional(),
    cta: z.string().optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "at least one script field is required",
  });

export function createScriptService(deps: { repository: ScriptRepository }) {
  return {
    async create(input: CreateScriptInput): Promise<ScriptRecord> {
      const payload = createSchema.parse(input);
      return deps.repository.createScript(payload);
    },

    async update(scriptId: string, input: UpdateScriptInput): Promise<ScriptRecord> {
      const payload = updateSchema.parse(input);
      return deps.repository.updateScript(scriptId, payload);
    },

    async getById(scriptId: string): Promise<ScriptRecord | null> {
      return deps.repository.findById(scriptId);
    },
  };
}

export function createPrismaScriptRepository(
  prisma: PrismaClient = defaultPrisma,
): ScriptRepository {
  return {
    async createScript(input) {
      await ensureWorkflowProjectExists(prisma, input.projectId);

      return prisma.script.create({
        data: {
          projectId: input.projectId,
          title: input.title,
          hook: input.hook,
          sellingPoints: input.sellingPoints,
          storyboard: input.storyboard,
          structuredJson: input.structuredJson,
          cta: input.cta,
        },
      });
    },

    async updateScript(scriptId, input) {
      return prisma.script.update({
        where: { id: scriptId },
        data: input,
      });
    },

    async findById(scriptId) {
      return prisma.script.findUnique({ where: { id: scriptId } });
    },
  };
}
