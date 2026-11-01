import React from 'react';
import { CharacterClassId, ItemDefinition } from '../types/game';

export const ProjectEtheriaTitleLockup: React.FC = () => (
  <svg
    viewBox="0 0 620 138"
    className="w-full max-w-[540px] h-auto select-none drop-shadow-[0_6px_18px_rgba(0,0,0,0.95)]"
    role="img"
    aria-label="Project Etheria Title Emblem"
  >
    <defs>
      <linearGradient id="ethGold" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#fef08a" />
        <stop offset="45%" stopColor="#f59e0b" />
        <stop offset="100%" stopColor="#92400e" />
      </linearGradient>
      <linearGradient id="ethBlade" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#e2e8f0" />
        <stop offset="60%" stopColor="#94a3b8" />
        <stop offset="100%" stopColor="#334155" />
      </linearGradient>
    </defs>

    {/* Ornate crest backdrop */}
    <path
      d="M22 69 L88 26 L532 26 L598 69 L532 112 L88 112 Z"
      fill="#0d131f"
      fillOpacity="0.88"
      stroke="url(#ethGold)"
      strokeWidth="2.5"
    />
    <path
      d="M34 69 L94 33 L526 33 L586 69 L526 105 L94 105 Z"
      fill="none"
      stroke="#fbbf24"
      strokeOpacity="0.35"
      strokeWidth="1"
    />

    {/* Left & Right Wing Filigree */}
    <polygon points="10,69 28,58 28,80" fill="url(#ethGold)" />
    <polygon points="610,69 592,58 592,80" fill="url(#ethGold)" />

    {/* Top Center Crown & World-Crystal */}
    <path
      d="M294 26 L310 6 L326 26 L310 38 Z"
      fill="#38bdf8"
      stroke="url(#ethGold)"
      strokeWidth="2"
    />
    <circle cx="310" cy="22" r="4" fill="#e0f2fe" />

    {/* Main Display Typography inside SVG */}
    <text
      x="310"
      y="64"
      textAnchor="middle"
      fill="url(#ethGold)"
      stroke="#090c10"
      strokeWidth="5"
      style={{
        paintOrder: 'stroke fill',
        fontFamily: 'Cinzel, Georgia, serif',
        fontWeight: 700,
        fontSize: '36px',
        letterSpacing: '0.16em',
      }}
    >
      PROJECT ETHERIA
    </text>

    <text
      x="310"
      y="92"
      textAnchor="middle"
      fill="#cbd5e1"
      style={{
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        fontWeight: 600,
        fontSize: '11.5px',
        letterSpacing: '0.28em',
      }}
    >
      CHRONICLES OF THE EIGHT REALMS
    </text>
  </svg>
);

export const ClassEmblemIcon: React.FC<{
  classId: CharacterClassId;
  className?: string;
}> = ({ classId, className = 'w-6 h-6' }) => {
  switch (classId) {
    case 'warrior':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path
            d="M19 3L13 9L15 11L21 5V3H19ZM3 21L5 19L9 15L11 17L7 21H3ZM14.5 7.5L6 16L8 18L16.5 9.5L14.5 7.5Z"
            fill="#f59e0b"
            stroke="#1c1917"
            strokeWidth="1.2"
          />
          <circle cx="6" cy="18" r="2.2" fill="#fef08a" />
        </svg>
      );
    case 'mage':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <circle cx="12" cy="8" r="5" fill="#38bdf8" stroke="#0f172a" strokeWidth="1.5" />
          <path d="M12 13V22M9 17H15" stroke="#bae6fd" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );
    case 'archer':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path
            d="M5 19C11 19 19 11 19 5M5 19L19 5M19 5H14M19 5V10"
            stroke="#10b981"
            strokeWidth="2.2"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'assassin':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path
            d="M4 20L14 10M20 4L10 14M15 4H20V9M4 15V20H9"
            stroke="#c084fc"
            strokeWidth="2.2"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'paladin':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path
            d="M12 2L4 5V11C4 16.5 7.4 21.6 12 23C16.6 21.6 20 16.5 20 11V5L12 2Z"
            fill="#eab308"
            stroke="#1c1917"
            strokeWidth="1.5"
          />
          <path d="M12 7V17M8 11H16" stroke="#fef9c3" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );
  }
};

export const ItemSvgIcon: React.FC<{
  iconType: ItemDefinition['iconType'];
  className?: string;
}> = ({ iconType, className = 'w-6 h-6' }) => {
  switch (iconType) {
    case 'sword':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path
            d="M18 3L21 6L9 18L5 19L6 15L18 3Z"
            fill="#e2e8f0"
            stroke="#0f172a"
            strokeWidth="1.5"
          />
          <path d="M4 20L8 16" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );
    case 'staff':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <line x1="5" y1="19" x2="16" y2="8" stroke="#a16207" strokeWidth="2.5" />
          <circle cx="17.5" cy="6.5" r="3.5" fill="#38bdf8" stroke="#e0f2fe" strokeWidth="1.2" />
        </svg>
      );
    case 'bow':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path d="M6 4C15 6 18 9 20 18" stroke="#d97706" strokeWidth="2.4" fill="none" />
          <line x1="6" y1="4" x2="20" y2="18" stroke="#e2e8f0" strokeWidth="1.2" />
        </svg>
      );
    case 'dagger':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <polygon points="19,5 12,15 9,12" fill="#c084fc" stroke="#0f172a" strokeWidth="1.2" />
          <line x1="6" y1="18" x2="11" y2="13" stroke="#f59e0b" strokeWidth="2.4" />
        </svg>
      );
    case 'hammer':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <rect x="11" y="3" width="9" height="6" rx="1.5" fill="#facc15" stroke="#0f172a" strokeWidth="1.4" />
          <line x1="6" y1="19" x2="15" y2="8" stroke="#a16207" strokeWidth="2.5" />
        </svg>
      );
    case 'armor':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path
            d="M7 4L12 6L17 4L20 9L17 11V20H7V11L4 9L7 4Z"
            fill="#94a3b8"
            stroke="#0f172a"
            strokeWidth="1.5"
          />
        </svg>
      );
    case 'helmet':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path
            d="M5 14C5 8.5 8 5 12 5C16 5 19 8.5 19 14V19H15V14H9V19H5V14Z"
            fill="#cbd5e1"
            stroke="#0f172a"
            strokeWidth="1.5"
          />
        </svg>
      );
    case 'boots':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path
            d="M8 5H14V14L19 16V19H6V15L8 13V5Z"
            fill="#b45309"
            stroke="#0f172a"
            strokeWidth="1.5"
          />
        </svg>
      );
    case 'ring':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <circle cx="12" cy="13" r="6" fill="none" stroke="#fbbf24" strokeWidth="2.5" />
          <polygon points="12,3 15,7 9,7" fill="#38bdf8" />
        </svg>
      );
    case 'potion_hp':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path
            d="M10 4H14V7L18 12V19C18 20.1 17.1 21 16 21H8C6.9 21 6 20.1 6 19V12L10 7V4Z"
            fill="#ef4444"
            stroke="#0f172a"
            strokeWidth="1.5"
          />
        </svg>
      );
    case 'potion_mp':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path
            d="M10 4H14V7L18 12V19C18 20.1 17.1 21 16 21H8C6.9 21 6 20.1 6 19V12L10 7V4Z"
            fill="#3b82f6"
            stroke="#0f172a"
            strokeWidth="1.5"
          />
        </svg>
      );
    case 'food':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <ellipse cx="12" cy="13" rx="7" ry="4.5" fill="#f97316" stroke="#0f172a" strokeWidth="1.5" />
        </svg>
      );
    case 'ore':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <polygon
            points="12,4 19,9 17,19 7,19 5,9"
            fill="#64748b"
            stroke="#0f172a"
            strokeWidth="1.5"
          />
          <circle cx="10" cy="11" r="1.5" fill="#fbbf24" />
          <circle cx="14" cy="14" r="1.5" fill="#38bdf8" />
        </svg>
      );
    case 'herb':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path
            d="M12 20V8M12 12C8 12 6 9 6 6C9 6 12 8 12 12ZM12 14C16 14 18 11 18 8C15 8 12 10 12 14Z"
            stroke="#4ade80"
            strokeWidth="2.2"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'fish':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path
            d="M3 12C6 7 13 7 17 12C13 17 6 17 3 12ZM17 12L21 8V16L17 12Z"
            fill="#38bdf8"
            stroke="#0f172a"
            strokeWidth="1.5"
          />
        </svg>
      );
    case 'gem':
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <polygon
            points="12,3 19,9 12,21 5,9"
            fill="#e879f9"
            stroke="#0f172a"
            strokeWidth="1.5"
          />
        </svg>
      );
  }
};
