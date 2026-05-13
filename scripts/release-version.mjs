#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";

const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z][0-9A-Za-z.-]*))?$/;
const betaPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)-beta\.([1-9]\d*)$/;

function usage(exitCode = 0) {
  const text = `
Usage:
  npm run release
  npm run release:as -- <version> [--push] [--dry-run]
  npm run release:beta -- <base-version|beta-version> [--push] [--dry-run] [--no-fetch]
  npm run release:major -- [--push] [--dry-run]

Examples:
  npm run release
  npm run release:as -- 1.0.0 --push
  npm run release:as -- 1.0.0-beta.1 --push
  npm run release:beta -- 1.0.0 --push
  npm run release:beta -- 1.0.0-beta.3 --push
  npm run release:major -- --push

What it does:
  Creates an empty commit with a Release-As footer.
  Release Please will open or update the release PR after that commit reaches main.
`;

  console.log(text.trim());
  process.exit(exitCode);
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function run(command, args, options = {}) {
  if (options.dryRun) {
    console.log(`$ ${[command, ...args].join(" ")}`);
    return "";
  }

  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
  }).trim();
}

function read(command, args) {
  return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function openPrompt() {
  if (input.isTTY) {
    return createInterface({ input, output });
  }

  const answers = readFileSync(0, "utf8").split(/\r?\n/);
  let answerIndex = 0;

  return {
    async question(question) {
      output.write(question);
      const answer = answers[answerIndex++] ?? "";
      output.write(`${answer}\n`);
      return answer;
    },
    close() {
      // Piped input does not create a readline handle.
    },
  };
}

function currentBranch() {
  return read("git", ["branch", "--show-current"]) || "(detached)";
}

function worktreeStatus() {
  return read("git", ["status", "--porcelain"]);
}

function parseArgs(argv) {
  const flags = new Set();
  const values = [];

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      usage();
    }

    if (arg.startsWith("--")) {
      flags.add(arg);
    } else {
      values.push(arg);
    }
  }

  return {
    command: values[0] ?? "interactive",
    value: values[1],
    dryRun: flags.has("--dry-run"),
    push: flags.has("--push"),
    noFetch: flags.has("--no-fetch"),
    allowBranch: flags.has("--allow-branch"),
  };
}

function assertValidVersion(version) {
  if (!version || !semverPattern.test(version)) {
    fail(`Expected a SemVer version like 1.0.0 or 1.0.0-beta.1, got '${version ?? ""}'.`);
  }

  if (version.includes("+")) {
    fail("Build metadata with '+' is not supported because Docker tags cannot use it safely.");
  }
}

function assertCleanWorktree() {
  const status = worktreeStatus();

  if (status) {
    fail("Working tree is not clean. Commit or stash current changes before creating a Release-As commit.");
  }
}

function assertMainBranch({ allowBranch }) {
  const branch = currentBranch();

  if (branch !== "main" && !allowBranch) {
    fail(`Release Please is configured for main, but the current branch is '${branch}'. Switch to main first.`);
  }
}

function currentPackageVersion() {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

  if (typeof pkg.version !== "string") {
    fail("package.json does not have a string version field.");
  }

  assertValidVersion(pkg.version);
  return pkg.version;
}

function nextMajorVersion() {
  const [major] = currentPackageVersion().split(".", 1).map(Number);
  const nextMajor = major === 0 ? 1 : major + 1;

  return `${nextMajor}.0.0`;
}

function nextMinorVersion() {
  const [major, minor] = currentPackageVersion().split(".", 2).map(Number);

  return `${major}.${minor + 1}.0`;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function nextBetaVersion(baseVersion, { noFetch, dryRun }) {
  assertValidVersion(baseVersion);

  if (betaPattern.test(baseVersion)) {
    return baseVersion;
  }

  if (baseVersion.includes("-")) {
    fail("release:beta accepts either a stable base version like 1.0.0 or an exact beta like 1.0.0-beta.1.");
  }

  if (!noFetch) {
    run("git", ["fetch", "--tags", "origin"], { dryRun });

    if (dryRun) {
      console.log("Dry run will not fetch remote tags. Calculating from local tags only.");
    }
  }

  const tags = read("git", ["tag", "--list"]).split("\n").filter(Boolean);
  const tagPattern = new RegExp(`^(?:.+-)?v?${escapeRegex(baseVersion)}-beta\\.([1-9]\\d*)$`);
  const highestBeta = tags.reduce((highest, tag) => {
    const match = tag.match(tagPattern);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);

  return `${baseVersion}-beta.${highestBeta + 1}`;
}

function createReleaseAsCommit(version, { dryRun, push }) {
  console.log(`Creating Release-As commit for ${version}`);
  run(
    "git",
    ["commit", "--allow-empty", "--no-verify", "-m", `chore: release ${version}`, "-m", `Release-As: ${version}`],
    {
      dryRun,
    },
  );

  if (dryRun) {
    console.log("Dry run only. No commit was created.");
    return;
  }

  if (push) {
    run("git", ["push"], { dryRun });
    return;
  }

  console.log("Commit created. Push it with: git push");
}

function describeDockerTags(version) {
  const tags = [`v${version}`, version];

  if (/^\d+\.\d+\.\d+$/.test(version)) {
    const [major, minor] = version.split(".");
    tags.push(`${major}.${minor}`);

    if (major !== "0") {
      tags.push(major);
    }

    tags.push("latest");
  }

  return tags.map((tag) => `leufrasiojunior/yapd:${tag}`);
}

function promptLabel(defaultValue) {
  return defaultValue ? "Y/n" : "y/N";
}

async function askRequired(rl, question, defaultValue) {
  while (true) {
    const suffix = defaultValue ? ` [${defaultValue}]` : "";
    const answer = (await rl.question(`${question}${suffix}: `)).trim();
    const value = answer || defaultValue;

    if (value) {
      return value;
    }

    console.log("Please enter a value.");
  }
}

async function confirm(rl, question, defaultValue = false) {
  while (true) {
    const answer = (await rl.question(`${question} (${promptLabel(defaultValue)}): `)).trim().toLowerCase();

    if (!answer) {
      return defaultValue;
    }

    if (["y", "yes", "s", "sim"].includes(answer)) {
      return true;
    }

    if (["n", "no", "nao", "não"].includes(answer)) {
      return false;
    }

    console.log("Answer with yes or no.");
  }
}

async function chooseReleaseKind(rl) {
  const choices = `
Choose what you want to prepare:
  1) Stable version chosen by me
  2) Beta version
  3) Next major version
  4) Help only / exit
`;

  while (true) {
    console.log(choices.trim());
    const answer = (await rl.question("Option [1]: ")).trim() || "1";

    if (["1", "stable", "as"].includes(answer.toLowerCase())) {
      return "as";
    }

    if (["2", "beta"].includes(answer.toLowerCase())) {
      return "beta";
    }

    if (["3", "major"].includes(answer.toLowerCase())) {
      return "major";
    }

    if (["4", "help", "exit", "quit"].includes(answer.toLowerCase())) {
      usage();
    }

    console.log("Choose 1, 2, 3, or 4.");
  }
}

function printReleaseSummary({ command, value, version, dryRun, push, noFetch }) {
  const gitTag = `yapd-v${version}`;

  console.log("");
  console.log("Release summary");
  console.log(`  Mode: ${command}`);
  if (value && value !== version) {
    console.log(`  Input: ${value}`);
  }
  console.log(`  Release-As: ${version}`);
  console.log(`  Expected Git tag from Release Please: ${gitTag}`);
  console.log(`  Docker tags after release:`);
  for (const tag of describeDockerTags(version)) {
    console.log(`    - ${tag}`);
  }
  console.log(`  Dry run: ${dryRun ? "yes" : "no"}`);
  console.log(`  Push after commit: ${push ? "yes" : "no"}`);
  if (command === "beta") {
    console.log(`  Fetch tags before calculating beta: ${noFetch ? "no" : "yes"}`);
  }
  console.log("");
}

async function collectInteractiveArgs(args) {
  const rl = openPrompt();

  try {
    const branch = currentBranch();
    const currentVersion = currentPackageVersion();
    const status = worktreeStatus();

    console.log("YAPD release assistant");
    console.log(`  Current package version: ${currentVersion}`);
    console.log(`  Current Git branch: ${branch}`);
    console.log(`  Release Please target branch: main`);
    console.log("");
    console.log("This creates an empty commit with a Release-As footer.");
    console.log("After that commit is pushed to main, Release Please opens or updates the release PR.");
    console.log("When the release PR is merged, it creates the Git tag and the Docker workflow publishes the image.");
    console.log("");

    if (status) {
      console.log("Warning: working tree is not clean. A real release commit will be blocked until it is clean.");
      console.log("");
    }

    const command = await chooseReleaseKind(rl);
    let value;

    if (command === "as") {
      value = await askRequired(rl, "Version to release", nextMinorVersion());
      assertValidVersion(value);
    } else if (command === "beta") {
      value = await askRequired(rl, "Stable target version or exact beta version", nextMajorVersion());
      assertValidVersion(value);
    }

    const dryRun = args.dryRun || (await confirm(rl, "Only simulate without creating a commit?", false));
    const push = dryRun ? false : args.push || (await confirm(rl, "Push the release commit after creating it?", true));
    const noFetch =
      command === "beta" && !betaPattern.test(value ?? "") && !args.noFetch
        ? !(await confirm(rl, "Fetch remote tags before calculating the next beta?", true))
        : args.noFetch;

    return {
      ...args,
      command,
      value,
      dryRun,
      push,
      noFetch,
    };
  } finally {
    rl.close();
  }
}

function resolveVersion(args) {
  switch (args.command) {
    case "as":
      assertValidVersion(args.value);
      return args.value;
    case "beta":
      return nextBetaVersion(args.value, args);
    case "major":
      return nextMajorVersion();
    default:
      fail(`Unknown release command '${args.command}'. Run npm run release:help for usage.`);
  }
}

async function main() {
  let args = parseArgs(process.argv.slice(2));
  const wasInteractive = args.command === "interactive";

  if (wasInteractive) {
    args = await collectInteractiveArgs(args);
  }

  if (!args.dryRun) {
    assertCleanWorktree();
    assertMainBranch(args);
  }

  const version = resolveVersion(args);
  printReleaseSummary({ ...args, version });

  if (!args.dryRun && wasInteractive) {
    const rl = openPrompt();
    try {
      const confirmed = await confirm(rl, "Create this Release-As commit now?", false);

      if (!confirmed) {
        fail("Cancelled.");
      }
    } finally {
      rl.close();
    }
  }

  createReleaseAsCommit(version, args);
}

await main();
