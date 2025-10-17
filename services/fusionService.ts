import { ABILITIES, ELEMENT_SYNERGIES } from '../constants';
import { Card, ElementType } from '../types';

const getAbilityIndex = (value: Card['wert']) => ABILITIES.indexOf(value);

const determineFusionElement = (first: Card, second: Card): ElementType => {
    const synergy = ELEMENT_SYNERGIES.find(
        entry => entry.elements.includes(first.element) && entry.elements.includes(second.element)
    );

    if (synergy) {
        return first.element === synergy.elements[0] ? first.element : second.element;
    }

    return getAbilityIndex(first.wert) >= getAbilityIndex(second.wert) ? first.element : second.element;
};

export const createFusionCard = (primary: Card, secondary: Card): Card => {
    const combinedIndex = Math.min(
        getAbilityIndex(primary.wert) + getAbilityIndex(secondary.wert),
        ABILITIES.length - 1
    );
    const fusedValue = ABILITIES[combinedIndex];
    const fusedElement = determineFusionElement(primary, secondary);
    const mergedMechanics = Array.from(new Set([...primary.mechanics, ...secondary.mechanics, 'Fusion']));
    const fusionCardType = primary.cardType === secondary.cardType ? primary.cardType : 'Beschwörung';
    const maxLifespan = Math.max(primary.lifespan ?? 0, secondary.lifespan ?? 0);
    const fusedLifespan = maxLifespan > 0 ? maxLifespan + 1 : undefined;
    const totalCharges = (primary.charges ?? 0) + (secondary.charges ?? 0);
    const fusedCharges = totalCharges > 0 ? totalCharges : undefined;

    return {
        element: fusedElement,
        wert: fusedValue,
        id: `fusion-${primary.id}-${secondary.id}-${Date.now()}`,
        cardType: fusionCardType,
        mechanics: mergedMechanics,
        lifespan: fusedLifespan,
        charges: fusedCharges,
    };
};

export const isFusionResult = (card: Card): boolean => card.id.startsWith('fusion-');
