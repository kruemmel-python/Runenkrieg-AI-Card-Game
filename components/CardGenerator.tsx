import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CARD_TYPES, ABILITY_MECHANIC_DEFINITIONS } from '../constants';
import { AbilityMechanicName, Card, CardTypeName } from '../types';
import {
    generateAndStoreCustomCards,
    subscribeToCardCatalog,
} from '../services/cardCatalogService';
import CardComponent from './Card';

const MECHANIC_ENTRIES = Object.entries(ABILITY_MECHANIC_DEFINITIONS);

const MAX_INPUT_COUNT = 200;

const CardGenerator: React.FC = () => {
    const [cardCount, setCardCount] = useState<number>(5);
    const [selectedType, setSelectedType] = useState<CardTypeName>(CARD_TYPES[0].name);
    const [selectedMechanics, setSelectedMechanics] = useState<AbilityMechanicName[]>([]);
    const [catalog, setCatalog] = useState<Card[]>([]);
    const [isCatalogOpen, setIsCatalogOpen] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [statusVariant, setStatusVariant] = useState<'success' | 'error'>('success');

    useEffect(() => {
        const unsubscribe = subscribeToCardCatalog((cards) => setCatalog(cards));
        return unsubscribe;
    }, []);

    const handleMechanicToggle = useCallback(
        (mechanic: AbilityMechanicName) => {
            setSelectedMechanics((prev) =>
                prev.includes(mechanic)
                    ? prev.filter((item) => item !== mechanic)
                    : [...prev, mechanic]
            );
        },
        []
    );

    const handleGenerate = useCallback(() => {
        setStatusMessage(null);
        const normalized = Number.isFinite(cardCount) ? Math.floor(cardCount) : 0;

        if (normalized <= 0) {
            setStatusVariant('error');
            setStatusMessage('Bitte gib eine gültige Anzahl an Karten ein.');
            return;
        }

        const safeCount = Math.min(normalized, MAX_INPUT_COUNT);
        const createdCards = generateAndStoreCustomCards({
            count: safeCount,
            cardType: selectedType,
            mechanics: selectedMechanics,
        });

        setStatusVariant('success');
        setStatusMessage(
            `${createdCards.length} neue ${createdCards.length === 1 ? 'Karte' : 'Karten'} generiert und dem Spiel hinzugefügt.`
        );
    }, [cardCount, selectedMechanics, selectedType]);

    const catalogStats = useMemo(() => {
        const customCards = catalog.filter((card) => card.origin === 'custom');
        const baseCards = catalog.length - customCards.length;
        return {
            baseCards,
            customCards: customCards.length,
            sortedCatalog: [...customCards, ...catalog.filter((card) => card.origin !== 'custom')],
        };
    }, [catalog]);

    return (
        <section className="mb-10 bg-slate-800/80 border border-slate-700 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-purple-300 mb-2">Spielkarten-Generator</h2>
            <p className="text-slate-300 mb-6">
                Erstelle neue Karten für das Spiel. Wähle die gewünschte Anzahl, den Kartentyp und die passenden Mechaniken.
                Beim Generieren werden Karten mit Stärken von 0 bis zur maximalen Stärke verteilt.
            </p>

            <div className="grid gap-6 md:grid-cols-2">
                <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-1" htmlFor="card-count">
                        Anzahl neuer Karten
                    </label>
                    <input
                        id="card-count"
                        type="number"
                        min={1}
                        max={MAX_INPUT_COUNT}
                        value={Number.isFinite(cardCount) ? cardCount : ''}
                        onChange={(event) => {
                            const value = parseInt(event.target.value, 10);
                            setCardCount(Number.isNaN(value) ? 0 : value);
                        }}
                        className="w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <p className="text-xs text-slate-400 mt-1">Maximum: {MAX_INPUT_COUNT} Karten pro Durchgang.</p>
                </div>

                <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-1" htmlFor="card-type">
                        Kartentyp
                    </label>
                    <select
                        id="card-type"
                        value={selectedType}
                        onChange={(event) => setSelectedType(event.target.value as CardTypeName)}
                        className="w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                        {CARD_TYPES.map((type) => (
                            <option key={type.name} value={type.name}>
                                {type.name}
                            </option>
                        ))}
                    </select>
                    <p className="text-xs text-slate-400 mt-1">Bestimmt Dauer oder Ladungen der generierten Karten.</p>
                </div>
            </div>

            <div className="mt-6">
                <h3 className="text-lg font-semibold text-slate-200 mb-3">Mechaniken auswählen</h3>
                <div className="grid gap-3 md:grid-cols-2">
                    {MECHANIC_ENTRIES.map(([mechanic, details]) => (
                        <label
                            key={mechanic}
                            className="flex items-start gap-3 bg-slate-900/70 border border-slate-700 rounded-md p-3 hover:border-purple-500 transition-colors cursor-pointer"
                        >
                            <input
                                type="checkbox"
                                checked={selectedMechanics.includes(mechanic as AbilityMechanicName)}
                                onChange={() => handleMechanicToggle(mechanic as AbilityMechanicName)}
                                className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-purple-500"
                            />
                            <span>
                                <span className="block font-semibold text-slate-100">{mechanic}</span>
                                <span className="block text-sm text-slate-400">{details.summary}</span>
                            </span>
                        </label>
                    ))}
                </div>
                <p className="text-xs text-slate-400 mt-2">
                    Mehrfachauswahl möglich – die Mechaniken werden auf alle generierten Karten angewendet.
                </p>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <button
                    onClick={handleGenerate}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-6 py-3 rounded-md transition-transform hover:scale-105"
                >
                    Karten generieren
                </button>
                {statusMessage && (
                    <span
                        className={`text-sm ${
                            statusVariant === 'success' ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                    >
                        {statusMessage}
                    </span>
                )}
            </div>

            <div className="mt-8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                        <p className="text-sm text-slate-300">
                            Gesamte Karten im Spiel: <span className="text-white font-semibold">{catalog.length}</span>{' '}
                            (Basis: {catalogStats.baseCards}, Neu: {catalogStats.customCards})
                        </p>
                        <p className="text-xs text-slate-500">
                            Neu generierte Karten werden automatisch in Simulation und Training berücksichtigt.
                        </p>
                    </div>
                    <button
                        onClick={() => setIsCatalogOpen((open) => !open)}
                        className="self-start sm:self-auto bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold px-4 py-2 rounded-md transition-colors"
                        type="button"
                    >
                        {isCatalogOpen ? 'Kartensammlung verbergen' : 'Kartensammlung anzeigen'}
                    </button>
                </div>

                {isCatalogOpen && (
                    <div className="mt-4 border border-slate-700 rounded-lg bg-slate-900/80">
                        <div className="max-h-96 overflow-y-auto p-4 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                            {catalogStats.sortedCatalog.map((card) => (
                                <div key={card.id} className="relative">
                                    {card.origin === 'custom' && (
                                        <span className="absolute -top-2 -right-2 bg-emerald-600 text-white text-xs font-semibold px-2 py-1 rounded-full shadow-lg">
                                            Neu
                                        </span>
                                    )}
                                    <CardComponent card={card} />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
};

export default CardGenerator;
