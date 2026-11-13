// Every URL that may receive an observation, with its arm and the date its 7/14/28-day windows start.
// Own pages use the production origin from config.json, so ledger entries do not depend on build env.
import { experimentConfig } from "./common.js";
import { buildLandingModel } from "./landings.js";
import { buildIndexKitModel } from "./indexkit.js";

export const buildObservationUnits = ({ indexkit = buildIndexKitModel() } = {}) => {
  const config = experimentConfig();
  const origin = config.productionOrigin;
  const own = path => new URL(path, origin).toString();
  const units = new Map();
  const add = unit => { if (units.has(unit.unit)) throw new Error("duplicate observation unit " + unit.unit); units.set(unit.unit, unit); };
  for (const page of buildLandingModel().pages)
    add({ unit: own(page.path), path: page.path, experiment: "A", kind: "landing", external: false,
      arm: page.indexCandidate ? "index-candidate" : "noindex", startDate: config.experiments.A.launchedAt });
  const batchById = new Map(indexkit.batches.map(b => [b.id, b]));
  for (const page of indexkit.pages) {
    const start = page.role === "batch" ? page.batch.publishedAt : indexkit.batches.map(b => b.publishedAt).filter(Boolean).sort()[0] || null;
    add({ unit: own(page.path), path: page.path, experiment: "C", kind: "carrier-" + page.role, external: false,
      arm: "carrier:" + page.effectiveIndex, startDate: start });
  }
  for (const target of indexkit.source.targets) {
    const batch = batchById.get(target.batch);
    add({ unit: target.url, path: null, experiment: "C", kind: "target", external: true, targetId: target.id, batchId: target.batch,
      arm: !target.group ? "unassigned" : target.group === "control" ? "control" : batch.arm,
      // Control shares the batch date so both groups are compared over identical calendar windows.
      startDate: batch.status === "live" ? batch.publishedAt : null });
  }
  return units;
};
