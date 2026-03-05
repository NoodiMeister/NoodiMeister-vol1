import React from 'react';
import { Loader2 } from 'lucide-react';

export default function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100">
      <Loader2 className="w-10 h-10 text-amber-600 animate-spin" aria-hidden="true" />
    </div>
  );
}
