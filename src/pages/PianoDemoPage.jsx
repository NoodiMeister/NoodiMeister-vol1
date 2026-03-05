/**
 * Demo-leht modulaarse klaveri testimiseks.
 * Hiir, klaviatuur (a,w,s,e,d,f,...) ja MIDI käivitavad heli ja esiletoomise.
 */

import React from 'react';
import { InteractivePiano } from '../piano';

export default function PianoDemoPage() {
  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 8 }}>Interaktiivne klaver</h1>
      <p style={{ color: '#666', marginBottom: 16, fontSize: 14 }}>
        Hiirega klõpsa klahve. Arvutiklaviatuur: A S D F G H J K L (valged), W E T Y U O P (mustad).
        MIDI-klaviatuur ühendamisel vali seade ülalt.
      </p>
      <InteractivePiano
        firstNote={48}
        lastNote={72}
        width={Math.min(800, typeof window !== 'undefined' ? window.innerWidth - 48 : 800)}
        height={180}
        showMidiSelect={true}
      />
    </div>
  );
}
