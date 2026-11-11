import type {
  FieldRejection,
  Rejected,
} from "@bookkeeping/application/shared/rejection";
import * as z from "zod";
import { describeProblemAs } from "./openapi.js";
import type { ProblemFieldError } from "./problem-details.js";
import {
  getProblemOptionsForStatus,
  problemDetailsSchema,
  problemFieldErrorSchema,
} from "./problem-details.js";

/** A field error as it crosses the wire: pointer and code, plus the facts the code names. */
export type RuleFieldError = ProblemFieldError &
  Readonly<Record<string, unknown>>;

/**
 * A code that carries facts beside its pointer: `facts` is the zod shape
 * published for the code, and `project` maps the application rejection's
 * facts onto it. Money goes through `presentMoney`, like everywhere else at
 * the edge.
 */
export interface FactualCodeEntry<Rejection> {
  facts: z.ZodRawShape;
  // Method syntax keeps the table assignable across its per-code entries.
  project(rejection: Rejection): Readonly<Record<string, unknown>>;
}

/** `"plain"` for a code whose message names no fact, else its facts. */
export type CodeEntry<Rejection> = "plain" | FactualCodeEntry<Rejection>;

/** Keyed by every code a feature's rejection can carry, so a new code fails to compile until published. */
export type CodeEntries<Rejection extends FieldRejection> = {
  [Code in Rejection["code"]]: CodeEntry<Extract<Rejection, { code: Code }>>;
};

/** What a feature publishes for its rejection codes, all derived from one table. */
export interface CodeTable<Rejection extends FieldRejection> {
  /** The published union of rule field errors, one variant per fact shape. */
  ruleFieldErrorSchema: z.ZodType;
  /** A request validation error; a rule code never passes as one, so its facts cannot go missing. */
  validationFieldErrorSchema: z.ZodType;
  /** A rule rejection or a request validation error: what a rejected command's `errors` holds. */
  fieldErrorSchema: z.ZodType;
  /** The 422 problem with its typed field errors. */
  problemSchema: z.ZodType;
  /** One rejection as a field error at the given pointer. */
  project(rejection: Rejection, pointer: string): RuleFieldError;
  /** The documented 422 a rejected command answers. */
  describeRejection(): ReturnType<typeof describeProblemAs<z.ZodType>>;
}

function pascalCase(code: string): string {
  return code
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}

/**
 * Declares one feature's code table and derives from it the published
 * field-error union, the refinement that keeps request-validation codes out of
 * it, and the projection. `feature` names the OpenAPI components, such as
 * `TagFieldError`.
 */
export function defineCodeTable<Rejection extends FieldRejection>(
  feature: string,
  entries: CodeEntries<Rejection>,
): CodeTable<Rejection> {
  const byCode: Readonly<Record<string, CodeEntry<Rejection>>> = entries;
  const plainCodes: string[] = [];
  const factualSchemas: z.core.$ZodTypeDiscriminable[] = [];
  for (const [code, entry] of Object.entries(byCode)) {
    if (entry === "plain") {
      plainCodes.push(code);
    } else {
      factualSchemas.push(
        problemFieldErrorSchema
          .extend({ code: z.literal(code), ...entry.facts })
          .meta({ id: `${feature}${pascalCase(code)}FieldError` }),
      );
    }
  }
  const plainSchemas =
    plainCodes.length === 0
      ? []
      : [
          problemFieldErrorSchema
            .extend({ code: z.enum(plainCodes) })
            .meta({ id: `${feature}PlainRuleFieldError` }),
        ];
  const [first, ...rest] = [...factualSchemas, ...plainSchemas];
  if (first === undefined) {
    throw new Error(`The ${feature} code table publishes no code`);
  }
  const ruleFieldErrorSchema = z
    .discriminatedUnion("code", [first, ...rest])
    .meta({ id: `${feature}RuleFieldError` });
  const ruleCodes: ReadonlySet<string> = new Set(Object.keys(byCode));
  const validationFieldErrorSchema = problemFieldErrorSchema
    .refine((fieldError) => !ruleCodes.has(fieldError.code))
    .meta({ id: `${feature}ValidationFieldError` });
  const fieldErrorSchema = z
    .union([ruleFieldErrorSchema, validationFieldErrorSchema])
    .meta({ id: `${feature}FieldError` });
  const problemSchema = problemDetailsSchema
    .extend({ errors: z.array(fieldErrorSchema).optional() })
    .meta({ id: `${feature}RejectionProblem` });
  return {
    ruleFieldErrorSchema,
    validationFieldErrorSchema,
    fieldErrorSchema,
    problemSchema,
    project(rejection, pointer) {
      const entry = byCode[rejection.code];
      const facts = entry === "plain" ? {} : entry?.project(rejection);
      return { pointer, code: rejection.code, ...facts };
    },
    describeRejection() {
      return describeProblemAs(getProblemOptionsForStatus(422), problemSchema);
    },
  };
}

/** A feature's pointer table and code table, the two things the edge needs to answer its rejections. */
export interface FieldRejectionTables<
  Field extends string,
  Rejection extends FieldRejection<Field>,
> {
  /** Where each refused input lives in the request document. */
  pointers: Readonly<Record<Field, string>>;
  codes: CodeTable<Rejection>;
}

/**
 * Turns the refused inputs of an operation into one field error each, in
 * order: the feature's pointer table places the field in the request
 * document, and its code table projects the code and facts.
 */
export function toFieldErrors<
  Field extends string,
  Rejection extends FieldRejection<Field>,
>(
  { rejections }: Readonly<Rejected<Rejection>>,
  { pointers, codes }: Readonly<FieldRejectionTables<Field, Rejection>>,
): RuleFieldError[] {
  return rejections.map((rejection) =>
    codes.project(rejection, pointers[rejection.field]),
  );
}
