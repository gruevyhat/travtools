import { useState } from 'react';
import ShipViewer from './ShipViewer';
import ShipBuilder from './ShipBuilder';

type Tab = 'fleet' | 'shipyard';

export default function ShipsHub() {
  const [tab, setTab] = useState<Tab>('fleet');

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-steel/50 bg-panel/40 flex-shrink-0">
        {(['fleet', 'shipyard'] as Tab[]).map(t => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-xs font-mono tracking-widest transition-colors border-b-2 ${
              tab === t
                ? 'border-amber text-amber'
                : 'border-transparent text-body/60 hover:text-bright hover:border-steel'
            }`}
          >
            {t === 'fleet' ? 'FLEET' : 'SHIPYARD'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {tab === 'fleet' ? <ShipViewer /> : <ShipBuilder />}
      </div>
    </div>
  );
}
