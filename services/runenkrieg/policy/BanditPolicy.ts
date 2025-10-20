import { FusionAction, FusionDecision, RKFusionContext, RKFusionOutcome, RKFusionPolicy } from './RKFusionPolicy';

interface ArmStats {
    mean: number;
    n: number;
}

const computeReward = (outcome: RKFusionOutcome, action: FusionAction) => {
    const outcomeScore = outcome.roundWinner === 'self' ? 1 : outcome.roundWinner === 'opponent' ? -1 : 0;
    const tokenScore = Math.max(-3, Math.min(3, outcome.tokenChange)) * 0.2;
    const actionBias = action === 'fuse' ? 0.05 : 0;
    return outcomeScore + tokenScore + actionBias;
};

export class BanditPolicy implements RKFusionPolicy {
    private readonly stats: Record<FusionAction, ArmStats> = {
        fuse: { mean: 0, n: 0 },
        skip: { mean: 0, n: 0 },
    };

    decide(context: RKFusionContext): FusionAction {
        const totalPulls = this.stats.fuse.n + this.stats.skip.n;
        const basePreference = context.candidate.projectedGain;

        if (totalPulls === 0) {
            return basePreference >= 1 ? 'fuse' : 'skip';
        }

        const scoreFor = (action: FusionAction) => {
            const arm = this.stats[action];
            const exploitation = arm.mean;
            const exploration = Math.sqrt(Math.log(totalPulls + 1) / (arm.n + 1));
            const prior = action === 'fuse' ? basePreference : Math.max(0, 0.5 - basePreference);
            return exploitation + 0.25 * prior + 0.4 * exploration;
        };

        const fuseScore = scoreFor('fuse');
        const skipScore = scoreFor('skip');

        if (fuseScore === skipScore) {
            return basePreference >= 0 ? 'fuse' : 'skip';
        }

        return fuseScore > skipScore ? 'fuse' : 'skip';
    }

    learn(decision: FusionDecision, outcome: RKFusionOutcome): void {
        const arm = this.stats[decision.action];
        const reward = computeReward(outcome, decision.action);
        arm.n += 1;
        const delta = reward - arm.mean;
        arm.mean += delta / arm.n;
    }
}
