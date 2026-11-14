// Pinned by digest so every machine and CI lint with the same ShellCheck.
const SHELLCHECK_IMAGE =
  "koalaman/shellcheck:v0.11.0@sha256:61862eba1fcf09a484ebcc6feea46f1782532571a34ed51fedf90dd25f925a8d";

interface ShellcheckRun {
  repository: string;
  files: readonly string[];
}

/** The `docker` arguments that lint `files`, or null when there is nothing to lint. */
export function shellcheckDockerArguments({
  repository,
  files,
}: Readonly<ShellcheckRun>): string[] | null {
  if (files.length === 0) {
    return null;
  }
  return [
    "run",
    "--rm",
    "--network",
    "none",
    "--volume",
    `${repository}:/mnt:ro`,
    "--workdir",
    "/mnt",
    SHELLCHECK_IMAGE,
    ...files,
  ];
}
