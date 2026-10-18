import { describe, expect, it } from "vitest";
import { findPublicIdentifiers } from "./find-public-identifiers";

function kindsIn(text: string): string[] {
  return findPublicIdentifiers(text).map(({ kind }) => kind);
}

describe("findPublicIdentifiers", () => {
  it("finds AWS account, organization and Identity Center IDs", () => {
    expect(kindsIn("account `123456789012` joined")).toEqual([
      "AWS account ID",
    ]);
    expect(kindsIn("Organization o-ab12cd34ef, root r-9xyz")).toEqual([
      "AWS Organizations ID",
      "AWS Organizations root ID",
    ]);
    expect(
      kindsIn(
        "https://d-0123456789.awsapps.com/start ssoins-0123456789abcdef ps-0123456789abcdef",
      ),
    ).toEqual([
      "IAM Identity Center instance",
      "IAM Identity Center store",
      "IAM Identity Center permission set",
    ]);
  });

  it("finds credentials, private hosts and personal email addresses", () => {
    expect(kindsIn("AKIAABCDEFGHIJKLMNOP")).toEqual(["AWS access key ID"]);
    expect(kindsIn(`AGE-SECRET-KEY-1${"Q".repeat(58)}`)).toEqual([
      "age private key",
    ]);
    expect(kindsIn("host shortline.proxy.rlwy.net:12345")).toEqual([
      "Railway TCP proxy host",
    ]);
    expect(kindsIn("owner+aws-backups@gmail.com")).toEqual([
      "personal email address",
    ]);
  });

  it("reports the line of each finding", () => {
    expect(findPublicIdentifiers("first\nsecond 123456789012")).toEqual([
      { line: 2, kind: "AWS account ID" },
    ]);
  });

  it("accepts placeholders and the wording documents already use", () => {
    const text = [
      "`<BACKUPS_ACCOUNT_ID>` and `https://<PORTAL_ID>.awsapps.com/start`",
      "the `proxy.rlwy.net` host, a `drwxr-xr-x` mode and a 13-digit 1739836800000",
      "mail from no-reply@signin.aws to probe@example.com",
      "o-ksfvpaqtm has no digit; r-xr-xr-x neither",
    ].join("\n");

    expect(findPublicIdentifiers(text)).toEqual([]);
  });
});
