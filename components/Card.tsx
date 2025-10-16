import React, { useState } from 'react';
import { Card as CardType } from '../types';
import { ELEMENT_COLORS, ABILITIES, ELEMENT_EFFECTS } from '../constants';

interface CardProps {
  card: CardType | null;
  isFaceDown?: boolean;
  onClick?: () => void;
  className?: string;
}

const Card: React.FC<CardProps> = ({ card, isFaceDown = false, onClick, className = '' }) => {
  const [isHovered, setIsHovered] = useState(false);

  if (isFaceDown) {
    return (
      <div className={`w-36 h-52 sm:w-40 sm:h-56 rounded-xl bg-slate-700 border-2 border-slate-500 shadow-lg flex items-center justify-center ${className} transition-transform duration-300`}>
        <div className="w-24 h-24 rounded-full bg-slate-800 flex items-center justify-center text-4xl text-slate-500">
         룬
        </div>
      </div>
    );
  }
  
  if (!card) {
     return <div className={`w-36 h-52 sm:w-40 sm:h-56 rounded-xl bg-slate-800/50 border-2 border-dashed border-slate-600 ${className}`} />;
  }

  const { element, wert } = card;
  const colors = ELEMENT_COLORS[element] || { from: 'from-gray-500', to: 'to-gray-400', icon: '❓' };

  return (
    <div
      className={`relative w-36 h-52 sm:w-40 sm:h-56 p-2 rounded-xl bg-gradient-to-br ${colors.from} ${colors.to} text-black border-2 border-white/50 shadow-xl flex flex-col justify-between cursor-pointer transform hover:scale-105 hover:shadow-2xl transition-all duration-300 ${className}`}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {isHovered && (
        <div 
            className="absolute bottom-full mb-2 w-44 -left-2 p-2 bg-slate-900 border border-slate-600 rounded-lg shadow-lg z-20 text-white text-xs animate-fade-in-fast" 
            style={{ pointerEvents: 'none' }}
        >
            <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-base text-cyan-400">{wert}</span>
                <span className="font-bold text-base text-yellow-400">Stärke: {ABILITIES.indexOf(wert)}</span>
            </div>
            <p className="mt-1 text-slate-300">{ELEMENT_EFFECTS[element]}</p>
        </div>
      )}

      <div className="flex justify-between items-start">
        <span className="text-xl font-bold break-words pr-1">{wert}</span>
        <span className="text-4xl">{colors.icon}</span>
      </div>
      <div className="text-center">
        <h3 className="text-lg font-bold tracking-wider">{element}</h3>
      </div>
      <div className="flex justify-between items-end">
        <span className="text-4xl transform -scale-x-100">{colors.icon}</span>
        <span className="text-xl font-bold break-words pl-1 text-right">{wert}</span>
      </div>
    </div>
  );
};

export default Card;