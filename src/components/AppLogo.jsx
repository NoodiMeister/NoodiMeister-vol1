import React from 'react';

/**
 * NoodiMeister logo with circular background/frame. Sizes are 5px larger than previous:
 * - header: 41px tall (was 36px / h-9), pill-shaped frame
 * - iconMd: 37px (was 32px / h-8)
 * - iconSm: 29px (was 24px / h-6)
 */
export function AppLogo({ variant = 'header', alt = 'NoodiMeister', className = '', ...props }) {
  const sizeMap = {
    header: { container: 'px-1.5 py-0.5', img: 'h-[41px] w-auto' },
    iconMd: { container: 'h-[37px] w-[37px]', img: 'h-[37px] w-[37px]' },
    iconSm: { container: 'h-[29px] w-[29px]', img: 'h-[29px] w-[29px]' },
  };
  const { container, img } = sizeMap[variant] || sizeMap.header;

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full overflow-hidden flex-shrink-0 bg-white dark:bg-amber-950/80 border border-amber-200/80 dark:border-amber-700/50 shadow-sm ${container} ${className}`}
      {...props}
    >
      <img
        src="/logo.png"
        alt={alt}
        className={`object-contain ${img}`}
        aria-hidden={!alt}
      />
    </span>
  );
}
