import {
  createTag,
  deleteTag,
  listTags,
  renameTag,
} from "@bookkeeping/application/tags";
import type { Database } from "@bookkeeping/database/connection";
import type { TagSummary } from "@bookkeeping/domain/tags";
import type { Input } from "hono";
import { Hono } from "hono";
import { describeResponse, describeRoute } from "hono-openapi";
import * as z from "zod";
import type { AuthenticatedEnv } from "../../core/auth/session.js";
import { createCollectionResponseSchema } from "../../core/http/collection.js";
import { toFieldErrors } from "../../core/http/field-rejections.js";
import type { idempotencyKeyHeaderSchema } from "../../core/http/idempotency.js";
import { idempotencyKeyMiddleware } from "../../core/http/idempotency.js";
import { describeProblemResponse } from "../../core/http/openapi.js";
import type { problemDetailsSchema } from "../../core/http/problem-details.js";
import type { ResourceCommandValidatedInput } from "../../core/http/request-validation.js";
import {
  createCommandMiddleware,
  createResourceParamMiddleware,
} from "../../core/http/request-validation.js";
import {
  answerCorrection,
  answerCreation,
  answerRemoval,
  describeCorrection,
  describeCreation,
} from "../../core/http/resource-answers.js";
import type { tagRejectionProblemSchema } from "./tag-rejection.js";
import { TAG_FIELD_POINTERS, tagCodes } from "./tag-rejection.js";

export const tagResponseSchema = z
  .object({ id: z.uuid(), name: z.string() })
  .meta({ id: "Tag" });

export const tagSummarySchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    transactionCount: z.number().int(),
    lastUsedAt: z.iso.datetime().nullable(),
  })
  .meta({ id: "TagSummary" });

export const tagCollectionResponseSchema = createCollectionResponseSchema(
  tagSummarySchema,
).meta({ id: "TagCollection" });

/** A create and a rename both name the tag and nothing else. */
export const tagNameRequestSchema = z
  .strictObject({ name: z.string() })
  .meta({ id: "TagNameRequest" });

type TagSummaryResponse = z.infer<typeof tagSummarySchema>;

function presentTagSummary(tag: Readonly<TagSummary>): TagSummaryResponse {
  return {
    id: tag.id,
    name: tag.name,
    transactionCount: tag.transactionCount,
    lastUsedAt: tag.lastUsedAt?.toISOString() ?? null,
  };
}

const COLLECTION_PATH = "/tags";
const RESOURCE_PATH = "/tags/:tagId";
const tagParamsSchema = z.object({ tagId: z.uuid() });
const tagParamMiddleware = createResourceParamMiddleware(tagParamsSchema);
const tagNameCommandMiddleware = createCommandMiddleware(tagNameRequestSchema);

interface CreateTagValidatedInput {
  in: {
    json: z.input<typeof tagNameRequestSchema>;
    header: z.input<typeof idempotencyKeyHeaderSchema>;
  };
  out: {
    json: z.output<typeof tagNameRequestSchema>;
    header: z.output<typeof idempotencyKeyHeaderSchema>;
  };
}

export function createTagRoutes(db: Database) {
  return new Hono<AuthenticatedEnv>()
    .post(
      COLLECTION_PATH,
      describeRoute({
        operationId: "createTag",
        summary: "Create a tag",
        description:
          "Creates a tag the signed-in owner can put on income and expense " +
          "transactions. Names are trimmed and unique per owner, ignoring " +
          "case. The request must carry a client-generated Idempotency-Key: " +
          "repeating it with the same normalized payload replays the " +
          "original creation, while a different payload is a conflict. A " +
          "rejected request never consumes its key.",
        tags: ["Tags"],
        responses: {
          400: describeProblemResponse(400),
          401: describeProblemResponse(401),
        },
      }),
      idempotencyKeyMiddleware,
      tagNameCommandMiddleware,
      describeResponse<
        AuthenticatedEnv,
        typeof COLLECTION_PATH,
        CreateTagValidatedInput,
        {
          201: typeof tagResponseSchema;
          409: typeof problemDetailsSchema;
          422: typeof tagRejectionProblemSchema;
        }
      >(
        async (c) => {
          const created = await createTag(db, {
            ownerId: c.get("session").user.id,
            idempotencyKey: c.req.valid("header")["idempotency-key"],
            name: c.req.valid("json").name,
          });
          return answerCreation(c, {
            result: created,
            present: (outcome) => ({ ...outcome.tag }),
            toFieldErrors: (rejected) =>
              toFieldErrors(rejected, {
                pointers: TAG_FIELD_POINTERS,
                codes: tagCodes,
              }),
          });
        },
        {
          ...describeCreation("tag", tagResponseSchema),
          422: tagCodes.describeRejection(),
        },
      ),
    )
    .get(
      COLLECTION_PATH,
      describeRoute({
        operationId: "listTags",
        summary: "List tags",
        description:
          "Returns the signed-in owner's tags in suggestion order: most " +
          "recently put on a current transaction first, then most used, " +
          "then by name, with unused tags last. Each carries how many " +
          "current income and expense transactions hold it and when it was " +
          "last put on one; refunds and deleted transactions never count. " +
          "The collection is unpaginated; `nextCursor` is always null.",
        tags: ["Tags"],
        responses: { 401: describeProblemResponse(401) },
      }),
      describeResponse<
        AuthenticatedEnv,
        typeof COLLECTION_PATH,
        Input,
        { 200: typeof tagCollectionResponseSchema }
      >(
        async (c) => {
          const listed = await listTags(db, c.get("session").user.id);
          return c.json(
            {
              items: listed.map(presentTagSummary),
              page: { nextCursor: null },
            },
            200,
          );
        },
        {
          200: {
            description: "The owner's tags in suggestion order",
            content: {
              "application/json": { vSchema: tagCollectionResponseSchema },
            },
          },
        },
      ),
    )
    .patch(
      RESOURCE_PATH,
      describeRoute({
        operationId: "updateTag",
        summary: "Rename a tag",
        description:
          "Renames one of the signed-in owner's tags everywhere it is " +
          "carried. Renaming to the name another of the owner's tags holds, " +
          "ignoring case, merges this tag into that one, which takes the " +
          "name as typed; the response is then that surviving tag, with its " +
          "own id. Neither changes the transactions' history. A tag that " +
          "does not exist, belongs to another owner, or has a malformed " +
          "identifier is not found alike.",
        tags: ["Tags"],
        responses: {
          400: describeProblemResponse(400),
          401: describeProblemResponse(401),
        },
      }),
      tagParamMiddleware,
      tagNameCommandMiddleware,
      describeResponse<
        AuthenticatedEnv,
        typeof RESOURCE_PATH,
        ResourceCommandValidatedInput<
          typeof tagParamsSchema,
          typeof tagNameRequestSchema
        >,
        {
          200: typeof tagResponseSchema;
          404: typeof problemDetailsSchema;
          422: typeof tagRejectionProblemSchema;
        }
      >(
        async (c) => {
          const renamed = await renameTag(db, {
            ownerId: c.get("session").user.id,
            id: c.req.valid("param").tagId,
            name: c.req.valid("json").name,
          });
          return answerCorrection(c, {
            result: renamed,
            present: (tag) => ({ ...tag }),
            toFieldErrors: (rejected) =>
              toFieldErrors(rejected, {
                pointers: TAG_FIELD_POINTERS,
                codes: tagCodes,
              }),
          });
        },
        {
          ...describeCorrection(
            "The renamed tag, or the tag it merged into",
            tagResponseSchema,
          ),
          422: tagCodes.describeRejection(),
        },
      ),
    )
    .delete(
      RESOURCE_PATH,
      describeRoute({
        operationId: "deleteTag",
        summary: "Delete a tag",
        description:
          "Deletes one of the signed-in owner's tags and takes it off every " +
          "transaction carrying it; the transactions stay. A tag that does " +
          "not exist, belongs to another owner, or has a malformed " +
          "identifier is not found alike.",
        tags: ["Tags"],
        responses: {
          204: { description: "The tag was deleted" },
          401: describeProblemResponse(401),
          404: describeProblemResponse(404),
        },
      }),
      tagParamMiddleware,
      async (c) => {
        const deleted = await deleteTag(db, {
          ownerId: c.get("session").user.id,
          id: c.req.valid("param").tagId,
        });
        return answerRemoval<never>(c, {
          result: deleted,
          // Nothing blocks a tag's removal, so no blocker reaches the mapper.
          toBlockerProblem: (blocker) => blocker,
        });
      },
    );
}
