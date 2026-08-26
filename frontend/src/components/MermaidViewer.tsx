import React, { useEffect, useRef } from 'react';
import mermaid from 'mermaid';

interface MermaidViewerProps {
  chart: string;
}

export const MermaidViewer: React.FC<MermaidViewerProps> = ({ chart }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      securityLevel: 'loose',
    });

    const renderChart = async () => {
      if (containerRef.current && chart) {
        if (chart === 'Generating diagram...') {
          containerRef.current.innerHTML = '<div class="text-slate-400 p-4 text-center mt-10">Generating diagram...</div>';
          return;
        }
        if (chart.startsWith('Error')) {
          containerRef.current.innerHTML = `<div class="text-red-400 p-4 text-center mt-10">${chart}</div>`;
          return;
        }
        try {
          containerRef.current.innerHTML = '';
          const { svg } = await mermaid.render(`mermaid-${Math.random().toString(36).substring(7)}`, chart);
          containerRef.current.innerHTML = svg;
        } catch (error) {
          console.error("Mermaid parsing error:", error);
          containerRef.current.innerHTML = `
            <div class="flex flex-col items-center justify-start w-full h-full p-6 text-slate-300">
              <div class="text-red-400 mb-4 font-semibold text-center">
                Mermaid parsing error. Displaying raw generated text:
              </div>
              <pre class="w-full bg-slate-950 p-4 rounded-lg overflow-auto text-sm font-mono border border-slate-800">
${chart.replace(/</g, "&lt;").replace(/>/g, "&gt;")}
              </pre>
            </div>
          `;
        }
      } else if (containerRef.current) {
        containerRef.current.innerHTML = '<div class="text-slate-400 p-4 text-center mt-10">Click "Visualize Code" to generate a flowchart.</div>';
      }
    };

    renderChart();
  }, [chart]);

  return (
    <div className="w-full h-full overflow-auto bg-slate-900 p-4 flex items-start justify-center">
      <div ref={containerRef} className="w-full h-full flex justify-center items-start" />
    </div>
  );
};
