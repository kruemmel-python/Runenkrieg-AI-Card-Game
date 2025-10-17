import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    CARD_TYPES,
    ABILITY_MECHANIC_DEFINITIONS,
    ABILITIES,
    ELEMENT_EFFECTS,
    ELEMENT_COLORS,
} from '../constants';
import { AbilityMechanicName, Card, CardTypeName } from '../types';
import {
    generateAndStoreCustomCards,
    subscribeToCardCatalog,
} from '../services/cardCatalogService';
import CardComponent from './Card';

const MECHANIC_ENTRIES = Object.entries(ABILITY_MECHANIC_DEFINITIONS);

const MAX_INPUT_COUNT = 200;

const TAILWIND_GRADIENT_COLORS: Record<string, string> = {
    'from-red-500': '#ef4444',
    'to-orange-400': '#fb923c',
    'from-blue-500': '#3b82f6',
    'to-cyan-400': '#22d3ee',
    'from-green-500': '#22c55e',
    'to-lime-400': '#a3e635',
    'from-yellow-200': '#fef08a',
    'to-gray-100': '#f5f5f5',
    'from-yellow-400': '#facc15',
    'to-yellow-300': '#fde047',
    'from-cyan-200': '#a5f3fc',
    'to-blue-300': '#93c5fd',
    'from-purple-500': '#a855f7',
    'to-indigo-400': '#818cf8',
    'from-gray-900': '#111827',
    'to-purple-900': '#312e81',
    'from-amber-200': '#fde68a',
    'to-yellow-100': '#fef9c3',
    'from-rose-500': '#f43f5e',
    'to-fuchsia-500': '#d946ef',
};

const DEFAULT_GRADIENT = { from: '#334155', to: '#1e293b' };

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

    const { baseCards, customCards, sortedCatalog } = catalogStats;

    const handleExportCollection = useCallback(() => {
        if (sortedCatalog.length === 0) {
            setStatusVariant('error');
            setStatusMessage('Es befinden sich keine Karten in der Sammlung zum Exportieren.');
            return;
        }

        const escapeHtml = (value: string) =>
            value
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');

        const resolveGradient = (element: Card['element']) => {
            const colors = ELEMENT_COLORS[element];
            const fromColor = colors ? TAILWIND_GRADIENT_COLORS[colors.from] ?? DEFAULT_GRADIENT.from : DEFAULT_GRADIENT.from;
            const toColor = colors ? TAILWIND_GRADIENT_COLORS[colors.to] ?? DEFAULT_GRADIENT.to : DEFAULT_GRADIENT.to;
            const icon = colors ? colors.icon : '❓';

            return { fromColor, toColor, icon };
        };

        const cardsMarkup = sortedCatalog
            .map((card) => {
                const { fromColor, toColor, icon } = resolveGradient(card.element);
                const abilityIndex = Math.max(0, ABILITIES.indexOf(card.wert as (typeof ABILITIES)[number]));

                const mechanicDetails = card.mechanics
                    .map((mechanic) => {
                        const definition = ABILITY_MECHANIC_DEFINITIONS[mechanic];
                        const summary = definition ? definition.summary : '';
                        return `<li><span class="mechanic-name">${escapeHtml(mechanic)}:</span> ${escapeHtml(summary)}</li>`;
                    })
                    .join('');

                const mechanicSection = card.mechanics.length
                    ? `<div class="tooltip-section"><p class="tooltip-title">Mechaniken</p><ul>${mechanicDetails}</ul></div>`
                    : '';

                const durationSection = card.lifespan || card.charges
                    ? `<div class="tooltip-section">${card.lifespan ? `<p>Dauer: ${card.lifespan} Züge</p>` : ''}${
                          card.charges ? `<p>Nutzungen: ${card.charges}</p>` : ''
                      }</div>`
                    : '';

                const tooltip = `
                    <div class="card-tooltip">
                        <div class="tooltip-header">
                            <span class="tooltip-value">${escapeHtml(card.wert)}</span>
                            <span class="tooltip-strength">Stärke: ${abilityIndex}</span>
                        </div>
                        <p class="tooltip-type">Typ: ${escapeHtml(card.cardType)}</p>
                        <p class="tooltip-effect">${escapeHtml(ELEMENT_EFFECTS[card.element])}</p>
                        ${mechanicSection}
                        ${durationSection}
                    </div>
                `;

                return `
                    <div class="card-wrapper">
                        ${card.origin === 'custom' ? '<span class="card-badge">Neu</span>' : ''}
                        <div class="card" style="background: linear-gradient(135deg, ${fromColor}, ${toColor});">
                            ${tooltip}
                            <div class="card-row top">
                                <span class="card-value">${escapeHtml(card.wert)}</span>
                                <span class="card-icon">${icon}</span>
                            </div>
                            <div class="card-center">
                                <h3>${escapeHtml(card.element)}</h3>
                                <p>${escapeHtml(card.cardType)}</p>
                            </div>
                            <div class="card-row bottom">
                                <span class="card-icon mirrored">${icon}</span>
                                <span class="card-value">${escapeHtml(card.wert)}</span>
                            </div>
                        </div>
                    </div>
                `;
            })
            .join('\n');

        const exportDate = new Date().toLocaleString('de-DE');

        const htmlContent = `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Kartensammlung Export</title>
    <style>
        :root {
            color-scheme: dark;
        }
        body {
            margin: 0;
            padding: 2rem;
            font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: radial-gradient(circle at top, #1f2937, #0f172a 60%);
            color: #e2e8f0;
        }
        h1 {
            font-size: 2rem;
            margin-bottom: 0.25rem;
        }
        h2 {
            font-size: 1rem;
            font-weight: 500;
            margin-top: 0;
            margin-bottom: 2rem;
            color: #94a3b8;
        }
        .card-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 1.5rem;
        }
        .card-wrapper {
            position: relative;
        }
        .card-badge {
            position: absolute;
            top: -0.5rem;
            right: -0.5rem;
            background: #10b981;
            color: #ecfdf5;
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.7rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            box-shadow: 0 10px 25px rgba(16, 185, 129, 0.4);
        }
        .card {
            position: relative;
            width: 230px;
            height: 330px;
            border-radius: 18px;
            padding: 14px;
            color: #0f172a;
            border: 2px solid rgba(255, 255, 255, 0.55);
            box-shadow: 0 20px 45px rgba(15, 23, 42, 0.55);
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            overflow: visible;
            cursor: pointer;
            transition: transform 160ms ease, box-shadow 160ms ease;
        }
        .card:hover {
            transform: translateY(-6px) scale(1.02);
            box-shadow: 0 25px 55px rgba(15, 23, 42, 0.6);
        }
        .card-row {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            font-weight: 700;
        }
        .card-row.bottom {
            align-items: flex-end;
        }
        .card-value {
            font-size: 1.35rem;
            word-break: break-word;
            max-width: 70%;
        }
        .card-icon {
            font-size: 2.3rem;
        }
        .card-icon.mirrored {
            transform: scaleX(-1);
        }
        .card-center {
            text-align: center;
            text-transform: uppercase;
            letter-spacing: 0.14em;
        }
        .card-center h3 {
            margin: 0;
            font-size: 1.3rem;
            letter-spacing: 0.06em;
        }
        .card-center p {
            margin: 0.3rem 0 0;
            font-size: 0.6rem;
            color: rgba(15, 23, 42, 0.75);
            font-weight: 700;
        }
        .card-tooltip {
            position: absolute;
            left: 0;
            bottom: calc(100% + 0.75rem);
            width: 260px;
            padding: 0.75rem;
            border-radius: 12px;
            background: rgba(15, 23, 42, 0.95);
            border: 1px solid rgba(148, 163, 184, 0.5);
            color: #e2e8f0;
            font-size: 0.75rem;
            line-height: 1.3;
            opacity: 0;
            transform: translateY(12px);
            transition: opacity 160ms ease, transform 160ms ease;
            pointer-events: none;
            box-shadow: 0 20px 35px rgba(15, 23, 42, 0.55);
            z-index: 15;
        }
        .card:hover .card-tooltip {
            opacity: 1;
            transform: translateY(0);
        }
        .tooltip-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.35rem;
        }
        .tooltip-value {
            font-size: 1.1rem;
            font-weight: 700;
            color: #22d3ee;
        }
        .tooltip-strength {
            font-weight: 700;
            color: #facc15;
        }
        .tooltip-type {
            margin: 0;
            font-weight: 600;
            color: #34d399;
        }
        .tooltip-effect {
            margin: 0.35rem 0 0;
            color: #cbd5f5;
        }
        .tooltip-section {
            margin-top: 0.65rem;
        }
        .tooltip-title {
            margin: 0 0 0.35rem;
            font-size: 0.7rem;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #60a5fa;
        }
        .tooltip-section ul {
            margin: 0;
            padding-left: 1.1rem;
            list-style: disc;
        }
        .tooltip-section li {
            margin-bottom: 0.25rem;
        }
        .mechanic-name {
            font-weight: 600;
            color: #38bdf8;
        }
        @media (max-width: 640px) {
            body {
                padding: 1.5rem;
            }
            .card {
                margin: 0 auto;
            }
            .card-tooltip {
                width: 220px;
            }
        }
    </style>
</head>
<body>
    <main>
        <h1>Kartensammlung</h1>
        <h2>Exportiert am ${escapeHtml(exportDate)}</h2>
        <section class="card-grid">
            ${cardsMarkup}
        </section>
    </main>
</body>
</html>`;

        const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `kartensammlung-${Date.now()}.html`;
        anchor.click();
        URL.revokeObjectURL(url);

        setStatusVariant('success');
        setStatusMessage('Kartensammlung als HTML exportiert.');
    }, [sortedCatalog]);

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
                            (Basis: {baseCards}, Neu: {customCards})
                        </p>
                        <p className="text-xs text-slate-500">
                            Neu generierte Karten werden automatisch in Simulation und Training berücksichtigt.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => setIsCatalogOpen((open) => !open)}
                            className="self-start sm:self-auto bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold px-4 py-2 rounded-md transition-colors"
                            type="button"
                        >
                            {isCatalogOpen ? 'Kartensammlung verbergen' : 'Kartensammlung anzeigen'}
                        </button>
                        <button
                            onClick={handleExportCollection}
                            className="self-start sm:self-auto bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-4 py-2 rounded-md transition-colors"
                            type="button"
                        >
                            Sammlung extrahieren
                        </button>
                    </div>
                </div>

                {isCatalogOpen && (
                    <div className="mt-4 border border-slate-700 rounded-lg bg-slate-900/80">
                        <div className="max-h-96 overflow-y-auto p-4 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                            {sortedCatalog.map((card) => (
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
