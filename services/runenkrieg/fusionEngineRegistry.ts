import { RKFusionEngine } from './RKFusionEngine';
import { BanditPolicy } from './policy/BanditPolicy';
import { loadBanditPolicyFromStorage, saveBanditPolicyToStorage } from './banditStorage';

let sharedFusionEngine: RKFusionEngine | null = null;

const createEngine = () => {
    const storedPolicy = loadBanditPolicyFromStorage();
    const policy = storedPolicy ?? new BanditPolicy();
    return new RKFusionEngine(policy, {
        onPolicyLearn: (updatedPolicy) => {
            if (updatedPolicy instanceof BanditPolicy) {
                saveBanditPolicyToStorage(updatedPolicy);
            }
        },
    });
};

export const getSharedFusionEngine = (): RKFusionEngine => {
    if (!sharedFusionEngine) {
        sharedFusionEngine = createEngine();
    }
    return sharedFusionEngine;
};

export const resetSharedFusionEngine = () => {
    sharedFusionEngine = null;
};
