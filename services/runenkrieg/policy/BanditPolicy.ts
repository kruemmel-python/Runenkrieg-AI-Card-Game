import { clampTokenDelta } from '../contextFocus';
import {
    FusionDecision,
    PolicyAction,
    RKFusionContext,
    RKFusionOutcome,
    RKFusionPolicy,
} from './RKFusionPolicy';

interface BanditArmStats {
    mean: number;
    count: number;
}

const EPSILON = 0.12;
const BASELINE_SKIP_VALUE = 0.05;

const sigmoid = (value: number) => 1 / (1 + Math.exp(-value));

const computeReward = (outcome: RKFusionOutcome): number => {
    const winScore = outcome.roundWinner === 'self' ? 1 : outcome.roundWinner === 'draw' ? 0.2 : -1;
    const tokenScore = Math.tanh(outcome.tokenChange / 5);
    return winScore + 0.6 * tokenScore;
};

const buildArmKey = (context: RKFusionContext, action: 'fuse' | 'skip') => {
    const { actor, hero, opponentHero, weather, candidate, boardSummary } = context;
    const clampedDiff = clampTokenDelta(boardSummary.tokenDiff);
    const fused = candidate.fusedCard;
    return [
        actor,
        hero,
        opponentHero,
        weather,
        `${fused.element}-${fused.wert}`,
        clampedDiff,
        action,
    ].join('|');
};

export class BanditPolicy implements RKFusionPolicy {
    private readonly stats = new Map<string, BanditArmStats>();

    selectAction(context: RKFusionContext): PolicyAction {
        const fuseArm = buildArmKey(context, 'fuse');
        const skipArm = buildArmKey(context, 'skip');

        const fuseStats = this.stats.get(fuseArm);
        const skipStats = this.stats.get(skipArm);

        const projectedGain = context.candidate.projectedGain;
        const exploration = Math.random() < EPSILON;

        if (exploration) {
            const bias = sigmoid(projectedGain);
            const action = Math.random() < bias ? 'fuse' : 'skip';
            return { action, armId: action === 'fuse' ? fuseArm : skipArm };
        }

        const fuseValue = (fuseStats?.mean ?? projectedGain);
        const skipValue = (skipStats?.mean ?? BASELINE_SKIP_VALUE);

        if (fuseValue > skipValue) {
            return { action: 'fuse', armId: fuseArm };
        }

        return { action: 'skip', armId: skipArm };
    }

    learn(decision: FusionDecision, outcome: RKFusionOutcome): void {
        const reward = computeReward(outcome);
        const current = this.stats.get(decision.armId) ?? { mean: 0, count: 0 };
        current.count += 1;
        current.mean += (reward - current.mean) / current.count;
        this.stats.set(decision.armId, current);
    }
}
