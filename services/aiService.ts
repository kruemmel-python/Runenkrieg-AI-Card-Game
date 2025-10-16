
import { Card, TrainedModel } from '../types';

let trainedModel: TrainedModel | null = null;

export function setTrainedModel(model: TrainedModel) {
    trainedModel = model;
}

export function isAiTrained(): boolean {
    return trainedModel !== null;
}

export function chooseCard(playerCard: Card, aiHand: Card[], gameState: any): Card {
    if (trainedModel) {
        return trainedModel.predict(playerCard, aiHand, gameState);
    }
    // Fallback: simple random choice if not trained
    return aiHand[Math.floor(Math.random() * aiHand.length)];
}
