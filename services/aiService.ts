import { AiGameState, AiPlayDecision, Card, TrainedModel } from '../types';
import { generateAiPlayOptions } from './aiDecisionEngine';

let trainedModel: TrainedModel | null = null;

export function setTrainedModel(model: TrainedModel) {
    trainedModel = model;
}

export function isAiTrained(): boolean {
    return trainedModel !== null;
}

const chooseFromOptions = (options: ReturnType<typeof generateAiPlayOptions>): AiPlayDecision => {
    if (options.length === 0) {
        throw new Error('No available AI options to choose from.');
    }

    const sorted = [...options].sort((a, b) => b.score - a.score);
    const topScore = sorted[0].score;
    const flexibleTop = sorted.filter(option => Math.abs(option.score - topScore) < 0.5);
    const selectionPool = flexibleTop.length > 0 ? flexibleTop : sorted;
    const chosen = selectionPool[Math.floor(Math.random() * selectionPool.length)];
    return chosen.decision;
};

export function chooseCard(playerCard: Card, aiHand: Card[], gameState: AiGameState): AiPlayDecision {
    if (aiHand.length === 0) {
        throw new Error('AI attempted to choose a card with an empty hand.');
    }

    if (trainedModel) {
        return trainedModel.predict(playerCard, aiHand, gameState);
    }

    const options = generateAiPlayOptions(playerCard, aiHand, {
        ...gameState,
        aiHandPreview: gameState.aiHandPreview ?? aiHand,
    });

    return chooseFromOptions(options);
}
