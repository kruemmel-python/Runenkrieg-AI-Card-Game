import { FusionAction, FusionDecision, RKFusionContext, RKFusionOutcome, RKFusionPolicy } from './RKFusionPolicy';

export interface ArmStats {
    mean: number;
    n: number;
}

export type SerializedBanditPolicy = [string, { fuse: ArmStats; skip: ArmStats }][];

const computeReward = (outcome: RKFusionOutcome, action: FusionAction) => {
    const outcomeScore = outcome.roundWinner === 'self' ? 1 : outcome.roundWinner === 'opponent' ? -1 : 0;
    const tokenScore = Math.max(-3, Math.min(3, outcome.tokenChange)) * 0.2;
    const actionBias = action === 'fuse' ? 0.05 : 0;
    return outcomeScore + tokenScore + actionBias;
};

const createEmptyArmStats = (): ArmStats => ({ mean: 0, n: 0 });

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const safeNumber = (value: number | null | undefined, fallback = 0) =>
    Number.isFinite(value) ? (value as number) : fallback;

export class BanditPolicy implements RKFusionPolicy {
    private table: Map<string, Record<FusionAction, ArmStats>> = new Map();

    private readonly globalStats: Record<FusionAction, ArmStats> = {
        fuse: createEmptyArmStats(),
        skip: createEmptyArmStats(),
    };

    decide(context: RKFusionContext): FusionAction {
        const key = this.buildContextKey(context);
        const entry = this.ensureEntry(key);
        const totalPulls = entry.fuse.n + entry.skip.n;
        const globalPulls = this.globalStats.fuse.n + this.globalStats.skip.n;
        const referencePulls = totalPulls > 0 ? totalPulls : globalPulls;
        const basePreference = context.candidate.projectedGain;

        if (referencePulls === 0) {
            return basePreference >= 1 ? 'fuse' : 'skip';
        }

        const scoreFor = (action: FusionAction) => {
            const arm = entry[action];
            const fallback = this.globalStats[action];
            const armMean = arm.n > 0 ? arm.mean : fallback.mean;
            const armPulls = arm.n > 0 ? arm.n : fallback.n;
            const exploitation = armMean;
            const exploration = Math.sqrt(Math.log(referencePulls + 1) / (armPulls + 1));
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
        const key = this.buildContextKey(decision.ctx);
        const entry = this.ensureEntry(key);
        const arm = entry[decision.action];
        const reward = computeReward(outcome, decision.action);
        arm.n += 1;
        const delta = reward - arm.mean;
        arm.mean += delta / arm.n;

        const globalArm = this.globalStats[decision.action];
        globalArm.n += 1;
        const globalDelta = reward - globalArm.mean;
        globalArm.mean += globalDelta / globalArm.n;
    }

    public serialize(): SerializedBanditPolicy {
        return Array.from(this.table.entries()).map(([key, stats]) => [
            key,
            {
                fuse: { mean: stats.fuse.mean, n: stats.fuse.n },
                skip: { mean: stats.skip.mean, n: stats.skip.n },
            },
        ]);
    }

    public static deserialize(serializedData: SerializedBanditPolicy | null | undefined): BanditPolicy {
        const policy = new BanditPolicy();
        if (!serializedData || !Array.isArray(serializedData)) {
            return policy;
        }

        let fuseSum = 0;
        let fuseCount = 0;
        let skipSum = 0;
        let skipCount = 0;

        serializedData.forEach((entry) => {
            if (!Array.isArray(entry) || entry.length !== 2) {
                return;
            }
            const [key, stats] = entry;
            if (typeof key !== 'string' || !stats) {
                return;
            }
            const normalized = {
                fuse: {
                    mean: safeNumber(stats.fuse?.mean),
                    n: clamp(Math.trunc(safeNumber(stats.fuse?.n)), 0, Number.MAX_SAFE_INTEGER),
                },
                skip: {
                    mean: safeNumber(stats.skip?.mean),
                    n: clamp(Math.trunc(safeNumber(stats.skip?.n)), 0, Number.MAX_SAFE_INTEGER),
                },
            } satisfies Record<FusionAction, ArmStats>;

            policy.table.set(key, normalized);

            if (normalized.fuse.n > 0) {
                fuseSum += normalized.fuse.mean * normalized.fuse.n;
                fuseCount += normalized.fuse.n;
            }
            if (normalized.skip.n > 0) {
                skipSum += normalized.skip.mean * normalized.skip.n;
                skipCount += normalized.skip.n;
            }
        });

        if (fuseCount > 0) {
            policy.globalStats.fuse.mean = fuseSum / fuseCount;
            policy.globalStats.fuse.n = fuseCount;
        }
        if (skipCount > 0) {
            policy.globalStats.skip.mean = skipSum / skipCount;
            policy.globalStats.skip.n = skipCount;
        }

        return policy;
    }

    public getSummary(): { contextCount: number; totalDecisions: number; fuseDecisions: number; skipDecisions: number } {
        let fuseDecisions = 0;
        let skipDecisions = 0;

        this.table.forEach((stats) => {
            fuseDecisions += stats.fuse.n;
            skipDecisions += stats.skip.n;
        });

        return {
            contextCount: this.table.size,
            totalDecisions: fuseDecisions + skipDecisions,
            fuseDecisions,
            skipDecisions,
        };
    }

    private ensureEntry(key: string): Record<FusionAction, ArmStats> {
        let entry = this.table.get(key);
        if (!entry) {
            entry = { fuse: createEmptyArmStats(), skip: createEmptyArmStats() };
            this.table.set(key, entry);
        }
        return entry;
    }

    private buildContextKey(context: RKFusionContext): string {
        const roundBucket = clamp(Math.trunc((context.roundNumber - 1) / 3), 0, 10);
        const maxAbilityBucket = clamp(Math.trunc(context.handSummary.maxAbilityIdx / 2), 0, 10);
        const averageAbilityBucket = clamp(Math.trunc(context.handSummary.averageAbilityIdx / 2), 0, 10);
        const fusionCountBucket = clamp(context.handSummary.fusionCount, 0, 6);
        const tokenDeltaBucket = clamp(Math.trunc(context.boardSummary.tokenDelta), -10, 10);
        const moraleBucket = clamp(Math.trunc(context.boardSummary.ownMorale * 5), -10, 10);
        const projectedGainBucket = clamp(Math.trunc(safeNumber(context.candidate.projectedGain) * 2), -20, 20);
        const baseGainBucket = clamp(Math.trunc(safeNumber(context.candidate.baseGain)), -10, 10);
        const synergyBucket = clamp(Math.trunc(safeNumber(context.candidate.synergyScore) * 2), -20, 20);
        const weatherBucket = clamp(Math.trunc(safeNumber(context.candidate.weatherScore) * 2), -20, 20);
        const heroBucket = clamp(Math.trunc(safeNumber(context.candidate.heroBonus) * 2), -20, 20);
        const tokenPressureBucket = clamp(Math.trunc(safeNumber(context.candidate.tokenPressure) * 2), -20, 20);
        const historyPressureBucket = clamp(Math.trunc(safeNumber(context.candidate.historyPressure) * 2), -20, 20);

        const opponentTokenBucket = clamp(Math.trunc(context.boardSummary.opponentTokens / 2), 0, 10);
        const ownTokenBucket = clamp(Math.trunc(context.boardSummary.ownTokens / 2), 0, 10);

        return [
            context.actor,
            context.hero,
            context.opponentHero,
            context.weather,
            roundBucket,
            maxAbilityBucket,
            averageAbilityBucket,
            fusionCountBucket,
            tokenDeltaBucket,
            moraleBucket,
            projectedGainBucket,
            baseGainBucket,
            synergyBucket,
            weatherBucket,
            heroBucket,
            tokenPressureBucket,
            historyPressureBucket,
            ownTokenBucket,
            opponentTokenBucket,
        ].join('|');
    }
}
