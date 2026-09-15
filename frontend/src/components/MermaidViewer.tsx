import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

// Initialize mermaid ONCE at module load time, not inside a render effect.
// Re-initializing on every render causes state corruption in Mermaid v11.
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  flowchart: {
    htmlLabels: true,     // allows quoted labels to render safely
    curve: 'basis',
    padding: 16,
  },
});

// ── Client-side Mermaid safety sanitizer ─────────────────────────────────
// A lightweight second-pass sanitizer that runs in the browser.
// The backend already sanitizes; this is a defense-in-depth layer.

const MERMAID_STARTS = ['flowchart', 'graph', 'sequenceDiagram', 'classDiagram',
  'stateDiagram', 'erDiagram', 'gantt', 'pie', 'gitGraph', 'mindmap'];

function clientSanitizeMermaid(raw: string): string {
  if (!raw || raw.trim() === '') return '';

  let src = raw.trim();

  // 1. Strip any remaining markdown fences
  src = src.replace(/^```(?:mermaid)?[\s\S]*?\n/i, '');
  src = src.replace(/```\s*$/, '');
  src = src.trim();

  // 2. Discard any prose before the first diagram keyword declaration
  const lines = src.split('\n');
  let diagStart = -1;
  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].trim().toLowerCase();
    if (MERMAID_STARTS.some(kw => lower.startsWith(kw.toLowerCase()))) {
      diagStart = i;
      break;
    }
  }
  if (diagStart > 0) {
    src = lines.slice(diagStart).join('\n').trim();
  }

  // 3. Validate start keyword
  const firstWord = src.trim().split(/\s/)[0].toLowerCase();
  const isValid = MERMAID_STARTS.some(kw => firstWord === kw.toLowerCase());
  if (!isValid) {
    return 'flowchart TD\n    E["Unable to parse diagram — please try again"]';
  }

  return src;
}

// ── Component ─────────────────────────────────────────────────────────────

interface MermaidViewerProps {
  chart: string;
}

let _renderCounter = 0; // monotonically increasing ID to avoid DOM conflicts

export const MermaidViewer: React.FC<MermaidViewerProps> = ({ chart }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rawSource, setRawSource] = useState<string | null>(null); // for error display

  useEffect(() => {
    const renderChart = async () => {
      if (!containerRef.current) return;

      // ── Idle state ──────────────────────────────────────────────────────
      if (!chart) {
        containerRef.current.innerHTML =
          '<div class="text-slate-400 p-4 text-center mt-10">Click "Visualize Code" to generate a flowchart.</div>';
        setRawSource(null);
        return;
      }

      // ── Loading state ───────────────────────────────────────────────────
      if (chart === 'Generating diagram...') {
        containerRef.current.innerHTML =
          '<div class="text-slate-400 p-4 text-center mt-10 animate-pulse">⚙ Generating diagram…</div>';
        setRawSource(null);
        return;
      }

      // ── Error passthrough from backend ──────────────────────────────────
      if (chart.startsWith('Error')) {
        containerRef.current.innerHTML =
          `<div class="text-red-400 p-4 text-center mt-10">${chart}</div>`;
        setRawSource(null);
        return;
      }

      // ── Sanitize before render ──────────────────────────────────────────
      const sanitized = clientSanitizeMermaid(chart);
      console.log('[MermaidViewer] source sent to mermaid.render():\n', sanitized);

      // ── Render ──────────────────────────────────────────────────────────
      try {
        containerRef.current.innerHTML = '';
        const id = `mermaid-cl-${++_renderCounter}`;
        const { svg } = await mermaid.render(id, sanitized);
        containerRef.current.innerHTML = svg;
        setRawSource(null);
      } catch (err: any) {
        console.error('[MermaidViewer] mermaid.render() failed:', err, '\nSource:\n', sanitized);
        setRawSource(sanitized);
        containerRef.current.innerHTML = ''; // clear so the React-rendered fallback shows
      }
    };

    renderChart();
  }, [chart]);

  return (
    <div className="w-full h-full overflow-auto bg-slate-900 p-4 flex flex-col items-start justify-start">
      {/* Main render target */}
      <div ref={containerRef} className="w-full flex justify-center items-start" />

      {/* Error fallback — shown when mermaid.render() throws */}
      {rawSource !== null && (
        <div className="w-full mt-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            Mermaid could not parse the diagram. Showing raw source:
          </div>
          <pre className="w-full bg-slate-950 p-4 rounded-lg overflow-auto text-xs font-mono border border-slate-700 text-slate-300 whitespace-pre-wrap">
            {rawSource}
          </pre>
          <p className="text-slate-500 text-xs">
            Check the browser console for the exact parse error. The diagram source above was logged just before rendering.
          </p>
        </div>
      )}
    </div>
  );
};
