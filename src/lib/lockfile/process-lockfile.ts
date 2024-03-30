import { useConfig } from "../config";
import { useLogger } from "../logger";
import { usePackageManager } from "../package-manager";
import type { PackagesRegistry } from "../types";
import { generateNpmLockfile } from "./helpers/generate-npm-lockfile";
import { generatePnpmLockfile } from "./helpers/generate-pnpm-lockfile";
import { generateYarnLockfile } from "./helpers/generate-yarn-lockfile";

/**
 * Adapt the lockfile and write it to the isolate directory. Because we keep the
 * structure of packages in the isolate directory the same as they were in the
 * monorepo, the lockfile is largely still correct. The only things that need to
 * be done is to remove the root dependencies and devDependencies, and rename
 * the path to the target package to act as the new root.
 */
export async function processLockfile({
  workspaceRootDir,
  packagesRegistry,
  isolateDir,
  internalDepPackageNames,
  targetPackageDir,
}: {
  workspaceRootDir: string;
  packagesRegistry: PackagesRegistry;
  isolateDir: string;
  internalDepPackageNames: string[];
  targetPackageDir: string;
  targetPackageName: string;
}) {
  const log = useLogger();

  const { forceNpm } = useConfig();

  if (forceNpm) {
    log.info("Forcing to use NPM for isolate output");

    await generateNpmLockfile({
      workspaceRootDir,
      isolateDir,
    });

    return true;
  }

  const { name, version } = usePackageManager();
  let usedFallbackToNpm = false;

  switch (name) {
    case "npm": {
      await generateNpmLockfile({
        workspaceRootDir,
        isolateDir,
      });

      break;
    }
    case "yarn": {
      const versionMajor = parseInt(version.split(".")[0], 10);

      if (versionMajor === 1) {
        await generateYarnLockfile({
          workspaceRootDir,
          isolateDir,
        });
      } else {
        log.info(
          "Detected modern version of Yarn. Using NPM lockfile fallback."
        );

        await generateNpmLockfile({
          workspaceRootDir,
          isolateDir,
        });

        usedFallbackToNpm = true;
      }

      break;
    }
    case "pnpm": {
      await generatePnpmLockfile({
        workspaceRootDir,
        targetPackageDir,
        isolateDir,
        internalDepPackageNames,
        packagesRegistry,
      });
      break;
    }
    default:
      log.warn(`Unexpected package manager ${name}. Using NPM for output`);
      await generateNpmLockfile({
        workspaceRootDir,
        isolateDir,
      });

      usedFallbackToNpm = true;
  }

  return usedFallbackToNpm;
}
