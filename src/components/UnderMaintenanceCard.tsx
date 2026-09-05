"use client";

import React from 'react';
import FuzzyText from './FuzzyText';
import './UnderMaintenanceCard.css';

export interface UnderMaintenanceCardProps {
  sectionName?: string;
  title?: string;
  statusPillText?: string;
  primaryMessage?: React.ReactNode;
  secondaryMessage?: string;
  buttonText?: string;
  onBack?: () => void;
  icon?: string;
  isEmbedded?: boolean;
  className?: string;
  accentPurple?: string;
  accentMagenta?: string;
  accentTeal?: string;
  accentGold?: string;
}

const UnderMaintenanceCard: React.FC<UnderMaintenanceCardProps> = ({
  sectionName = 'System Portal',
  title = 'Under Maintenance',
  statusPillText = 'TEMPORARY SYSTEM UPGRADE',
  primaryMessage,
  secondaryMessage = 'Please check back shortly or explore other available club services.',
  buttonText = 'Return to Dashboard',
  onBack,
  icon = 'construction',
  isEmbedded = false,
  className = '',
  accentPurple,
  accentMagenta,
  accentTeal,
  accentGold,
}) => {
  // Allow custom property overrides via inline style if passed
  const customStyles: React.CSSProperties = {};
  if (accentPurple) customStyles['--maintenance-purple-accent' as any] = accentPurple;
  if (accentMagenta) customStyles['--maintenance-magenta-accent' as any] = accentMagenta;
  if (accentTeal) customStyles['--maintenance-teal-accent' as any] = accentTeal;
  if (accentGold) customStyles['--maintenance-gold-accent' as any] = accentGold;

  return (
    <div
      className={`under-maintenance-root under-maintenance-container ${isEmbedded ? 'embedded' : ''} ${className}`}
      style={customStyles}
    >
      {/* Ambient Bokeh / Plasma Glowing Blobs */}
      <div className="maintenance-plasma-layer" aria-hidden="true">
        <div className="plasma-blob plasma-blob-purple-tl" />
        <div className="plasma-blob plasma-blob-magenta-tr" />
        <div className="plasma-blob plasma-blob-teal-bl" />
        <div className="plasma-blob plasma-blob-purple-br" />
        <div className="plasma-blob plasma-blob-magenta-center" />
      </div>

      {/* Centered Glassmorphic Status Card */}
      <div className="maintenance-card">
        {/* Icon Badge */}
        <div className="maintenance-icon-badge" aria-hidden="true">
          <span className="material-symbols-outlined maintenance-icon">
            {icon}
          </span>
        </div>

        {/* Status Pill */}
        <div className="maintenance-status-pill">
          <span className="status-pulse-dot" />
          <span>{statusPillText}</span>
        </div>

        {/* Heading with FuzzyText Cyberpunk Animation */}
        <h1 className="maintenance-heading">
          <FuzzyText
            fontSize="clamp(1.75rem, 4vw, 2.35rem)"
            fontWeight={900}
            fontFamily="var(--font-head), 'Space Grotesk', -apple-system, sans-serif"
            color="#ffffff"
            enableHover={true}
            baseIntensity={0.16}
            hoverIntensity={0.45}
            fuzzRange={24}
            fps={45}
            direction="horizontal"
            clickEffect={true}
          >
            {title}
          </FuzzyText>
        </h1>

        {/* Body Text */}
        <div className="maintenance-body">
          <p className="maintenance-body-primary">
            {primaryMessage ? (
              primaryMessage
            ) : (
              <>
                The <span className="maintenance-highlight">{sectionName}</span>{' '}section is currently undergoing scheduled maintenance &amp; improvements.
              </>
            )}
          </p>
          {secondaryMessage && (
            <p className="maintenance-body-secondary">{secondaryMessage}</p>
          )}
        </div>

        {/* CTA Button */}
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="maintenance-cta-button"
          >
            <span className="material-symbols-outlined btn-arrow-icon">arrow_back</span>
            <span>{buttonText}</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default UnderMaintenanceCard;
