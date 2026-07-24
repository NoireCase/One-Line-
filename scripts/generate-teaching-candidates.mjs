/**
 * Sequential teaching level generator v2.
 * Uses human logic engine for fast pre-filtering, then full lesson simulator for acceptance.
 *
 * Usage: node scripts/generate-teaching-candidates.mjs <levelNumber> [--resume]
 */
import { generateDoubleStarCandidate } from './star-double-generator.mjs';
import { analyzeStarDoubleHumanLogic, DEDUCTION_TECHNIQUE as T, HUMAN_LOGIC_STATUS as S } from './star-double-human-logic.mjs';
import { simulateLesson } from './simulate-teaching-lesson.mjs';
import { resolveCandidatePath, safeWriteJSON } from './lib/star-line-candidate-io.mjs';
import { computeOpeningFingerprint } from './star-line-fingerprint.mjs';
import { existsSync, readFileSync } from 'node:fs';

const LEVEL_IDS = { 2:'star-double-tutorial-02', 3:'star-double-tutorial-03', 4:'star-double-tutorial-04', 5:'star-double-tutorial-05', 6:'star-double-tutorial-06', 7:'star-double-tutorial-07', 8:'star-double-tutorial-08' };

const ALL_BASIC = [T.QUOTA_SATURATED, T.ADJACENCY_EXCLUSION, T.REMAINING_CAPACITY, T.TWO_BY_TWO_CAPACITY];
const ALL_ADVANCED = [...ALL_BASIC, T.CONFINED_CAPACITY, T.MULTI_UNIT_CONFINEMENT, T.PRESSURED_GROUP_EXCLUSION];

const MAX_ATTEMPTS = 200;
const MAX_SUPPLEMENT = 200;
const N = 8;

function fastPreFilter(puzzle, lvNum) {
  const full = analyzeStarDoubleHumanLogic(puzzle, { solverStatus: 'UNIQUE' });
  if (full.status !== S.SOLVED_SUPPORTED_RULES) return { ok: false, reason: `not solved: ${full.status}` };

  const path = full.canonicalPath || [];
  const topicCfg = {
    2: { tech: T.ADJACENCY_EXCLUSION, gateType: 'concept' },
    3: { tech: T.QUOTA_SATURATED, gateType: 'rule' },
    4: { tech: T.REMAINING_CAPACITY, gateType: 'rule' },
    5: { tech: null, gateType: 'strategy' },
    6: { tech: T.CONFINED_CAPACITY, gateType: 'rule' },
    7: { tech: T.CONFINED_CAPACITY, gateType: 'rule' },
    8: { tech: T.CONFINED_CAPACITY, gateType: 'rule' },
  };

  const cfg = topicCfg[lvNum];
  if (!cfg) return { ok: true };

  const topicEvents = path.filter(e => e.technique === cfg.tech || e.supportingTechniques?.includes(cfg.tech));
  const firstTopic = topicEvents.length > 0 ? path.indexOf(topicEvents[0]) : -1;
  const starPlacements = path.filter(e => e.action === 'place-star');
  const firstStarDepth = starPlacements.length > 0 ? path.indexOf(starPlacements[0]) : -1;

  if (cfg.gateType === 'concept' && lvNum === 2) {
    // Lv.2: need at least 2 adjacency events
    return {
      ok: topicEvents.length >= 2 && full.status === S.SOLVED_SUPPORTED_RULES,
      topicEvents: topicEvents.length,
      firstTopic,
      firstStarDepth,
    };
  }

  if (cfg.gateType === 'rule') {
    // Rule courses: topic must be required
    let prereqTechs;
    if (lvNum === 3) prereqTechs = ALL_BASIC.filter(t => t !== T.QUOTA_SATURATED);
    else if (lvNum === 4) prereqTechs = ALL_BASIC.filter(t => t !== T.REMAINING_CAPACITY);
    else if (lvNum <= 5) prereqTechs = ALL_BASIC;
    else prereqTechs = ALL_BASIC;

    const prereq = analyzeStarDoubleHumanLogic(puzzle, { solverStatus: 'UNIQUE', allowedTechniques: prereqTechs });
    const topicRequired = prereq.status !== S.SOLVED_SUPPORTED_RULES;

    return {
      ok: topicRequired && topicEvents.length >= 2 && full.status === S.SOLVED_SUPPORTED_RULES,
      topicRequired,
      topicEvents: topicEvents.length,
      firstTopic,
      firstStarDepth,
    };
  }

  return { ok: full.status === S.SOLVED_SUPPORTED_RULES };
}

function main() {
  const args = process.argv.slice(2);
  const lvNum = parseInt(args[0], 10);
  if (!lvNum || lvNum < 2 || lvNum > 8) {
    console.error('Usage: node generate-teaching-candidates.mjs <2-8> [--resume]');
    process.exit(1);
  }

  const resume = args.includes('--resume');
  const levelId = LEVEL_IDS[lvNum];
  const checkpointPath = resolveCandidatePath(`teaching-v3-lv${lvNum}-checkpoint.json`);

  let startAttempt = 0;
  let totalAttempts = 0;
  const seenSigs = new Set();
  let bestScore = -999;

  if (resume && existsSync(checkpointPath)) {
    const cp = JSON.parse(readFileSync(checkpointPath, 'utf8'));
    if (cp.passed) { console.log(`Lv.${lvNum}: Already passed.`); process.exit(0); }
    startAttempt = cp.lastAttempt || 0;
    totalAttempts = cp.totalAttempts || 0;
    bestScore = cp.bestScore || -999;
    (cp.seenSigs || []).forEach(s => seenSigs.add(s));
    console.log(`Resuming Lv.${lvNum} from attempt ${startAttempt}`);
  }

  const baseSeed = 20260725 + lvNum * 100;
  let passed = false;

  for (let phase = 0; phase < 2 && !passed; phase++) {
    const maxA = phase === 0 ? MAX_ATTEMPTS : MAX_SUPPLEMENT;
    const seed = baseSeed + phase * 10007;
    const startAt = phase === 0 ? startAttempt : 0;

    for (let attempt = startAt; attempt < maxA && !passed; attempt++) {
      totalAttempts++;
      const ds = seed + attempt * 31337;

      try {
        const cand = generateDoubleStarCandidate(N, ds, 0, { maxAttempts: 200 });
        if (!cand) continue;
        if (seenSigs.has(cand.canonicalRegionSignature)) continue;
        seenSigs.add(cand.canonicalRegionSignature);

        const puzzle = { N, regions: cand.regions, solution: cand.solution };
        const pre = fastPreFilter(puzzle, lvNum);

        if (!pre.ok) continue;

        // Run full lesson simulation
        const sim = simulateLesson(puzzle, levelId);
        const score = (sim.pass ? 1000 : 0)
          + (sim.metrics?.guidedStepCount || 0) * 100
          + (sim.metrics?.practiceStepCount || 0) * 100
          + (sim.metrics?.topicEventCount || 0) * 10
          - (sim.errors?.length || 0) * 50;

        if (score > bestScore) {
          bestScore = score;
          safeWriteJSON(checkpointPath, {
            lvNum, levelId, lastAttempt: attempt, totalAttempts,
            bestScore, bestPre: pre, bestErrors: sim.errors,
            seenSigs: [...seenSigs].slice(0, 1000), passed: false,
          }, { force: true });
        }

        if (sim.pass) {
          const fp = computeOpeningFingerprint(N, cand.regions, 2);
          const accepted = { levelId, lvNum, regions: cand.regions, solution: cand.solution, seed: ds, totalAttempts, openingFingerprint: fp.fingerprint, simulation: sim };
          safeWriteJSON(checkpointPath + '.accepted', accepted, { force: true });
          safeWriteJSON(checkpointPath, { ...JSON.parse(readFileSync(checkpointPath, 'utf8')), passed: true, accepted }, { force: true });
          console.log(`\n✓ Lv.${lvNum} ACCEPTED after ${totalAttempts} attempts`);
          passed = true;
          break;
        }
      } catch (e) { /* skip */ }

      if (totalAttempts % 100 === 0) {
        console.log(`  Lv.${lvNum}: ${totalAttempts} attempts, best score=${bestScore}, pre ok=${pre?.ok}`);
      }
    }
  }

  if (!passed) {
    console.log(`\n✗ Lv.${lvNum} FAILED after ${totalAttempts} total attempts. Best score: ${bestScore}`);
    process.exit(1);
  }
}

main();
