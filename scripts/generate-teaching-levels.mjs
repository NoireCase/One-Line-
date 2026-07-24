/**
 * Sequential teaching level generator.
 * Generates Lv.2-8 candidates, validates via lesson simulator, checkpoints each.
 * Usage: node scripts/generate-teaching-levels.mjs [--resume] [--level 2]
 */
import { generateDoubleStarCandidate } from './star-double-generator.mjs';
import { simulateLesson } from './simulate-teaching-lesson.mjs';
import { computeOpeningFingerprint } from './star-line-fingerprint.mjs';
import { resolveCandidatePath, safeWriteJSON } from './lib/star-line-candidate-io.mjs';
import { existsSync, readFileSync } from 'node:fs';

const LEVELS = [2,3,4,5,6,7,8];
const LEVEL_IDS = {2:'star-double-tutorial-02',3:'star-double-tutorial-03',4:'star-double-tutorial-04',5:'star-double-tutorial-05',6:'star-double-tutorial-06',7:'star-double-tutorial-07',8:'star-double-tutorial-08'};
const N = 8;
const MAX_PER_PHASE = 300;
const MAX_PHASES = 2;

function main() {
  const args = process.argv.slice(2);
  const resume = args.includes('--resume');
  const levelFilter = args.includes('--level') ? parseInt(args[args.indexOf('--level')+1],10) : null;
  const levels = levelFilter ? [levelFilter] : LEVELS;

  for (const lvNum of levels) {
    const levelId = LEVEL_IDS[lvNum];
    const cpPath = resolveCandidatePath(`teach-lv${lvNum}-checkpoint.json`);
    const acceptedPath = resolveCandidatePath(`teach-lv${lvNum}-accepted.json`);

    // Check if already accepted
    if (existsSync(acceptedPath)) {
      console.log(`Lv.${lvNum}: already accepted, skipping`);
      continue;
    }

    let startPhase = 0, startAttempt = 0, totalAttempts = 0, bestScore = -999;
    const seenSigs = new Set();

    if (resume && existsSync(cpPath)) {
      const cp = JSON.parse(readFileSync(cpPath, 'utf8'));
      startPhase = cp.phase || 0;
      startAttempt = cp.attempt || 0;
      totalAttempts = cp.total || 0;
      bestScore = cp.bestScore || -999;
      (cp.seen || []).forEach(s => seenSigs.add(s));
      console.log(`Lv.${lvNum}: resuming phase ${startPhase} attempt ${startAttempt}`);
    }

    let passed = false;

    for (let phase = startPhase; phase < MAX_PHASES && !passed; phase++) {
      const baseSeed = 20260725 + lvNum * 100 + phase * 10007;
      const start = phase === startPhase ? startAttempt : 0;

      for (let attempt = start; attempt < MAX_PER_PHASE && !passed; attempt++) {
        totalAttempts++;
        const ds = baseSeed + attempt * 31337;

        const cand = generateDoubleStarCandidate(N, ds, 0, { maxAttempts: 150 });
        if (!cand) continue;
        if (seenSigs.has(cand.canonicalRegionSignature)) continue;
        seenSigs.add(cand.canonicalRegionSignature);

        const puzzle = { N, regions: cand.regions, solution: cand.solution };
        const sim = simulateLesson(puzzle, levelId);

        const score = (sim.pass ? 10000 : 0)
          + (sim.metrics?.adjStepCount || 0) * 100
          + (sim.metrics?.topicStepCount || 0) * 100
          + (sim.metrics?.topicEventCount || 0) * 50
          + (sim.metrics?.autonomousReachable ? 500 : 0)
          - (sim.errors?.length || 0) * 200;

        if (score > bestScore) {
          bestScore = score;
          safeWriteJSON(cpPath, {
            lvNum, levelId, phase, attempt, total: totalAttempts,
            bestScore, seen: [...seenSigs].slice(-500),
          }, { force: true });
        }

        if (sim.pass) {
          const fp = computeOpeningFingerprint(N, cand.regions, 2);
          safeWriteJSON(acceptedPath, {
            levelId, lvNum, regions: cand.regions, solution: cand.solution,
            seed: ds, totalAttempts, fingerprint: fp.fingerprint, simulation: sim,
          }, { force: true });
          console.log(`✓ Lv.${lvNum} ACCEPTED (${totalAttempts} attempts, seed ${ds})`);
          console.log(`  adjSteps=${sim.metrics.adjStepCount} topicSteps=${sim.metrics.topicStepCount} topicRequired=${sim.metrics.actualTopicRequired}`);
          passed = true;
          break;
        }

        if (totalAttempts % 100 === 0) {
          console.log(`  Lv.${lvNum}: ${totalAttempts} attempts, best=${bestScore}`);
        }
      }
    }

    if (!passed) {
      console.log(`✗ Lv.${lvNum}: FAILED after ${totalAttempts} attempts (best score: ${bestScore})`);
    }
  }
}

main();
