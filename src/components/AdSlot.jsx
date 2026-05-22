import React from "react";

/**
 * Unobtrusive ad slot. Replace `children` with your ad provider script.
 * No popups, no autoplay, no overlay — visible space only.
 */
const SIZES = {
  banner: "h-[60px] sm:h-[90px]",
  sidebar: "h-[250px]",
  inline: "h-[120px]",
  footer: "h-[90px]",
};

const AdSlot = ({ variant = "banner", label = "Sponsored", testid }) => {
  const sizeCls = SIZES[variant] || SIZES.banner;
  return (
    <div className={`w-full ${sizeCls} bg-[#0c0e12] border border-dashed border-[#272A30] flex items-center justify-center relative`}
         data-ad-slot={variant} data-testid={testid || `ad-slot-${variant}`}>
      <div className="text-center">
        <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-zinc-600">{label}</div>
        <div className="font-display text-xs text-zinc-500 mt-1">Ad space · {variant}</div>
      </div>
    </div>
  );
};

export default AdSlot;
