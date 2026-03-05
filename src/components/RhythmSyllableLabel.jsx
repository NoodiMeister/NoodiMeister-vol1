import React from 'react';

/**
 * Kodály rütmisilbi tekst noodi või rütmigrupi all (Teacher Mode).
 * Asub täpselt vastava noodi või grupi keskpunkti all.
 *
 * Props:
 *   x: horisontaalne keskpunkt (üks noot) või grupi keskpunkt
 *   y: vertikaalne positsioon (tavaliselt joonestiku alumine joon + offset)
 *   text: kuvatav silp (nt "TA", "TI TI", "TI RI TI RI")
 *   fontSize: optional (default from staffSpace)
 *   staffSpace: optional, kasutatakse fonti suuruse arvutamiseks
 */
export function RhythmSyllableLabel({
  x = 0,
  y = 0,
  text = '',
  fontSize,
  staffSpace = 10,
  fill = '#333',
  fontFamily = 'sans-serif',
}) {
  if (!text || String(text).trim() === '') return null;
  const size = fontSize ?? Math.max(10, staffSpace * 1.1);
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="hanging"
      fontSize={size}
      fill={fill}
      fontFamily={fontFamily}
      fontWeight="600"
    >
      {text}
    </text>
  );
}

export default RhythmSyllableLabel;
