/**
 * PerformanceAnalyticsCard.tsx
 *
 * Full-width dashboard card displaying interactive Performance Graphs &
 * Algorithmic Scalability Analytics for saved programs in dashboard history.
 *
 * Features:
 *  1. Execution Time Benchmark Graph (interactive SVG bar / comparison across algorithms & input scales)
 *  2. Big-O Scalability Growth Curves (O(1), O(log n), O(n), O(n log n), O(n²), O(2ⁿ)) with current program trajectory
 *  3. Complexity & Resource Distribution Breakdown (Time & Space complexity allocation)
 *  4. Interactive Input Size Scalability Simulator (slider for N = 10 to 100,000)
 */

import { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp, BarChart3, Clock, Zap, Database,
  Cpu, Sliders, Play, RefreshCw, Layers
} from 'lucide-react';
import { fetchSavedPrograms, type SavedProgram } from '../../services/dashboardService';

interface Props {
  programs?: SavedProgram[];
  onOpenProgram?: (p: SavedProgram, triggerRun?: boolean, triggerVisualize?: boolean) => void;
  onSelectProgram?: (p: SavedProgram) => void;
}

export interface EnrichedProgram extends SavedProgram {
  lines: number;
  complexity: string;
  spaceComplexity: string;
  langColor: string;
  execMs: number;
  memoryKb: number;
  isUser: boolean;
}

const LANG_COLOR: Record<string, string> = {
  python: '#3b82f6',
  java: '#f59e0b',
  cpp: '#8b5cf6',
  c: '#06b6d4',
  javascript: '#facc15',
  typescript: '#818cf8',
};

function getLangColor(lang: string): string {
  return LANG_COLOR[lang?.toLowerCase()] || '#6366f1';
}

function getLineCount(codeStr: string): number {
  if (!codeStr) return 0;
  return codeStr.split('\n').filter((l: string) => l.trim().length > 0).length;
}

function parseComplexity(codeStr: string): { time: string; space: string } {
  const loops = (codeStr.match(/\bfor\b|\bwhile\b|\bdo\b/g) || []).length;
  const hasSort = /sort|sorted|Arrays\.sort|std::sort/i.test(codeStr);
  const hasRecursion = /\b(\w+)\s*\([^)]*\)[\s\S]*?\1\s*\(/.test(codeStr);
  const hasBinary = /mid\s*=|binary.*search|\/=\s*2|>>= 1/i.test(codeStr);
  const hasMatrix = /\[\s*\]\s*\[\s*\]|vector<vector/i.test(codeStr);
  const hasAlloc = /new\s+|malloc|vector|ArrayList|HashSet|HashMap/i.test(codeStr);

  let time = 'O(1)';
  if (hasRecursion && /return.*\+.*\(/.test(codeStr)) time = 'O(2ⁿ)';
  else if (loops >= 3) time = 'O(n³)';
  else if (loops === 2) time = 'O(n²)';
  else if (hasSort) time = 'O(n log n)';
  else if (loops === 1) time = 'O(n)';
  else if (hasBinary) time = 'O(log n)';

  let space = 'O(1)';
  if (hasMatrix) space = 'O(n²)';
  else if (hasAlloc || hasRecursion) space = 'O(n)';

  return { time, space };
}

// Benchmark baseline programs for rich graph comparison
const BENCHMARK_ALGORITHMS: SavedProgram[] = [
  {
    program_id: 'bench-1',
    name: 'Binary Search',
    language: 'java',
    code: 'public int binarySearch(int[] arr, int target) {\n  int l = 0, r = arr.length - 1;\n  while (l <= r) {\n    int m = l + (r - l) / 2;\n    if (arr[m] == target) return m;\n    if (arr[m] < target) l = m + 1; else r = m - 1;\n  }\n  return -1;\n}',
    description: 'Logarithmic divide-and-conquer search',
    output: '✓ In-Browser Execution Completed\nTime: 1 ms | Memory: 320 KB',
    status: 'completed',
    line_count: 10,
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    program_id: 'bench-2',
    name: 'Two Sum (Hash Map)',
    language: 'python',
    code: 'def two_sum(nums, target):\n    seen = {}\n    for i, num in enumerate(nums):\n        diff = target - num\n        if diff in seen:\n            return [seen[diff], i]\n        seen[num] = i\n    return []',
    description: 'Single-pass linear hash lookup',
    output: '✓ In-Browser Execution Completed\nTime: 2 ms | Memory: 540 KB',
    status: 'completed',
    line_count: 9,
    created_at: new Date(Date.now() - 3600000 * 18).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    program_id: 'bench-3',
    name: 'Merge Sort',
    language: 'cpp',
    code: 'void mergeSort(vector<int>& a, int l, int r) {\n  if (l >= r) return;\n  int m = l + (r - l) / 2;\n  mergeSort(a, l, m);\n  mergeSort(a, m + 1, r);\n  merge(a, l, m, r);\n}',
    description: 'Optimal divide-and-conquer sorting',
    output: '✓ In-Browser Execution Completed\nTime: 5 ms | Memory: 980 KB',
    status: 'completed',
    line_count: 8,
    created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    program_id: 'bench-4',
    name: 'Bubble Sort',
    language: 'c',
    code: 'void bubbleSort(int arr[], int n) {\n  for (int i = 0; i < n - 1; i++) {\n    for (int j = 0; j < n - i - 1; j++) {\n      if (arr[j] > arr[j + 1]) {\n        int t = arr[j]; arr[j] = arr[j + 1]; arr[j + 1] = t;\n      }\n    }\n  }\n}',
    description: 'Quadratic nested comparison sort',
    output: '✓ In-Browser Execution Completed\nTime: 18 ms | Memory: 410 KB',
    status: 'completed',
    line_count: 11,
    created_at: new Date(Date.now() - 3600000 * 6).toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export function PerformanceAnalyticsCard({ programs: initialPrograms, onOpenProgram, onSelectProgram }: Props) {
  const [userPrograms, setUserPrograms] = useState<SavedProgram[]>(initialPrograms || []);
  const [loading, setLoading] = useState<boolean>(!initialPrograms);
  const [activeTab, setActiveTab] = useState<'graphs' | 'curves' | 'distribution' | 'simulator'>('graphs');
  const [selectedProgramId, setSelectedProgramId] = useState<string>('');

  const loadData = () => {
    setLoading(true);
    fetchSavedPrograms({ limit: 25 })
      .then((res) => {
        if (res?.items) {
          setUserPrograms(res.items);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (initialPrograms && initialPrograms.length > 0) {
      setUserPrograms(initialPrograms);
      setLoading(false);
      return;
    }
    loadData();
  }, [initialPrograms]);

  // Combine user programs with standard algorithmic baselines
  const allEnriched: EnrichedProgram[] = useMemo(() => {
    const rawList: { p: SavedProgram; isUser: boolean }[] = [];

    userPrograms.forEach((p) => rawList.push({ p, isUser: true }));

    // Include benchmarks so graphs always have comprehensive comparison data
    BENCHMARK_ALGORITHMS.forEach((b) => {
      if (!userPrograms.some((u) => u.name.toLowerCase() === b.name.toLowerCase())) {
        rawList.push({ p: b, isUser: false });
      }
    });

    return rawList.map(({ p, isUser }) => {
      const code = p.code || '';
      const { time, space } = parseComplexity(code);
      const timeMatch = (p.output || '').match(/Time:\s*(\d+)\s*ms/i);
      const memMatch = (p.output || '').match(/Memory:\s*~?(\d+)\s*KB/i);

      let execMs = timeMatch ? parseInt(timeMatch[1], 10) : 2;
      if (!timeMatch) {
        if (time === 'O(1)') execMs = 1;
        else if (time === 'O(log n)') execMs = 2;
        else if (time === 'O(n)') execMs = 3;
        else if (time === 'O(n log n)') execMs = 6;
        else if (time === 'O(n²)') execMs = 15;
        else if (time === 'O(n³)') execMs = 42;
        else if (time === 'O(2ⁿ)') execMs = 78;
      }

      const memoryKb = memMatch ? parseInt(memMatch[1], 10) : (space === 'O(1)' ? 320 : space === 'O(n)' ? 750 : 1800);

      return {
        ...p,
        lines: p.line_count || getLineCount(code),
        complexity: time,
        spaceComplexity: space,
        langColor: getLangColor(p.language),
        execMs: Math.max(1, execMs),
        memoryKb,
        isUser,
      };
    });
  }, [userPrograms]);

  // Default selected program
  useEffect(() => {
    if (allEnriched.length > 0 && !selectedProgramId) {
      const firstUser = allEnriched.find((p) => p.isUser);
      setSelectedProgramId(firstUser ? firstUser.program_id : allEnriched[0].program_id);
    }
  }, [allEnriched, selectedProgramId]);

  const activeProgram = allEnriched.find((p) => p.program_id === selectedProgramId) || allEnriched[0];

  const handleProgramClick = (p: EnrichedProgram) => {
    setSelectedProgramId(p.program_id);
    if (onSelectProgram) onSelectProgram(p);
  };

  return (
    <div id="performance-graphs" className="dash-card" style={{ marginBottom: '24px', overflow: 'hidden' }}>
      {/* ── Card Header ─────────────────────────────────────────────────── */}
      <div className="dash-card-title" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
            padding: '7px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
          }}>
            <TrendingUp size={16} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.01em' }}>
                Performance Graphs &amp; Algorithmic Scalability
              </span>
              <span style={{
                fontSize: '11px', fontWeight: 700, color: '#38bdf8',
                background: '#0369a125', border: '1px solid #0284c740',
                borderRadius: '999px', padding: '1px 8px',
              }}>
                Live Analytics
              </span>
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
              Comparing {userPrograms.length} saved program{userPrograms.length !== 1 ? 's' : ''} in your history across theoretical growth curves &amp; execution benchmarks.
            </div>
          </div>
        </div>

        {/* Tab Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{
            display: 'flex', gap: '4px', background: '#090d16',
            padding: '3px', borderRadius: '10px', border: '1px solid #1e293b',
          }}>
            <button
              onClick={() => setActiveTab('graphs')}
              style={{
                fontSize: '11px', padding: '5px 11px', borderRadius: '7px', border: 'none', cursor: 'pointer',
                background: activeTab === 'graphs' ? '#4f46e5' : 'transparent',
                color: activeTab === 'graphs' ? '#fff' : '#94a3b8', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: '5px', transition: 'all 0.15s',
              }}
            >
              <BarChart3 size={13} />
              <span>Speed Benchmarks</span>
            </button>

            <button
              onClick={() => setActiveTab('curves')}
              style={{
                fontSize: '11px', padding: '5px 11px', borderRadius: '7px', border: 'none', cursor: 'pointer',
                background: activeTab === 'curves' ? '#4f46e5' : 'transparent',
                color: activeTab === 'curves' ? '#fff' : '#94a3b8', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: '5px', transition: 'all 0.15s',
              }}
            >
              <TrendingUp size={13} />
              <span>Big-O Growth Curves</span>
            </button>

            <button
              onClick={() => setActiveTab('distribution')}
              style={{
                fontSize: '11px', padding: '5px 11px', borderRadius: '7px', border: 'none', cursor: 'pointer',
                background: activeTab === 'distribution' ? '#4f46e5' : 'transparent',
                color: activeTab === 'distribution' ? '#fff' : '#94a3b8', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: '5px', transition: 'all 0.15s',
              }}
            >
              <Layers size={13} />
              <span>Complexity Distribution</span>
            </button>

            <button
              onClick={() => setActiveTab('simulator')}
              style={{
                fontSize: '11px', padding: '5px 11px', borderRadius: '7px', border: 'none', cursor: 'pointer',
                background: activeTab === 'simulator' ? '#4f46e5' : 'transparent',
                color: activeTab === 'simulator' ? '#fff' : '#94a3b8', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: '5px', transition: 'all 0.15s',
              }}
            >
              <Sliders size={13} />
              <span>Scale Simulator</span>
            </button>
          </div>

          <button
            onClick={loadData}
            title="Refresh analytics data"
            style={{
              background: '#090d16', border: '1px solid #1e293b', borderRadius: '8px',
              padding: '6px', color: '#94a3b8', cursor: 'pointer',
            }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── Content View Switcher ─────────────────────────────────────── */}
      <div style={{ marginTop: '16px' }}>
        {activeTab === 'graphs' && (
          <ExecutionBenchmarkView
            programs={allEnriched}
            selectedId={selectedProgramId}
            onSelect={handleProgramClick}
            onOpenInEditor={onOpenProgram}
          />
        )}

        {activeTab === 'curves' && (
          <BigOGrowthCurvesView
            programs={allEnriched}
            activeProgram={activeProgram}
            onSelect={handleProgramClick}
            onOpenInEditor={onOpenProgram}
          />
        )}

        {activeTab === 'distribution' && (
          <ComplexityDistributionView
            programs={allEnriched}
            selectedId={selectedProgramId}
            onSelect={handleProgramClick}
          />
        )}

        {activeTab === 'simulator' && (
          <ScalabilitySimulatorView
            programs={allEnriched}
            activeProgram={activeProgram}
            onSelect={handleProgramClick}
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEW 1: EXECUTION SPEED BENCHMARKS (Interactive SVG Bar Chart & Metrics)
// ─────────────────────────────────────────────────────────────────────────────

function ExecutionBenchmarkView({
  programs,
  selectedId,
  onSelect,
  onOpenInEditor,
}: {
  programs: EnrichedProgram[];
  selectedId: string;
  onSelect: (p: EnrichedProgram) => void;
  onOpenInEditor?: (p: SavedProgram) => void;
}) {
  const maxMs = Math.max(...programs.map((p) => p.execMs), 20);
  const selected = programs.find((p) => p.program_id === selectedId) || programs[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* KPI Highlight Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
        <div style={{ background: '#090d16', border: '1px solid #1e293b', borderRadius: '10px', padding: '12px 14px' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={12} color="#818cf8" /> Fastest Execution
          </div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#34d399', marginTop: '4px' }}>
            {Math.min(...programs.map((p) => p.execMs))} ms
          </div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>Near-instant client run</div>
        </div>

        <div style={{ background: '#090d16', border: '1px solid #1e293b', borderRadius: '10px', padding: '12px 14px' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Cpu size={12} color="#38bdf8" /> Average Memory
          </div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#38bdf8', marginTop: '4px' }}>
            {Math.round(programs.reduce((acc, p) => acc + p.memoryKb, 0) / programs.length)} KB
          </div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>Lightweight heap foot-print</div>
        </div>

        <div style={{ background: '#090d16', border: '1px solid #1e293b', borderRadius: '10px', padding: '12px 14px' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Zap size={12} color="#fbbf24" /> Optimal Time Share
          </div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#fbbf24', marginTop: '4px' }}>
            {Math.round((programs.filter((p) => ['O(1)', 'O(log n)', 'O(n)'].includes(p.complexity)).length / programs.length) * 100)}%
          </div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>Linear or sublinear algorithms</div>
        </div>
      </div>

      {/* Main Bar Chart Container */}
      <div style={{
        background: '#090d16', border: '1px solid #1e293b', borderRadius: '12px',
        padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '14px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9' }}>
              Execution Speed Comparison Chart (Time in Milliseconds)
            </span>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
              Lower execution time indicates superior speed. Click any bar to inspect complexity details.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#38bdf8' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#38bdf8' }} /> Your Saved Programs
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#94a3b8' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#64748b' }} /> Standard Benchmarks
            </span>
          </div>
        </div>

        {/* SVG Horizontal Bar Chart */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', marginTop: '4px' }}>
          {programs.map((p) => {
            const isSelected = p.program_id === selectedId;
            const widthPct = Math.min(100, Math.max(10, (p.execMs / maxMs) * 100));

            return (
              <div
                key={p.program_id}
                onClick={() => onSelect(p)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '170px 1fr 90px 110px',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '7px 10px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  background: isSelected ? 'rgba(79, 70, 229, 0.15)' : 'rgba(15, 23, 42, 0.4)',
                  border: isSelected ? '1px solid rgba(99, 102, 241, 0.5)' : '1px solid transparent',
                  transition: 'all 0.15s ease',
                }}
              >
                {/* Program Name & Language Tag */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                  <span style={{
                    fontSize: '9px', fontWeight: 800, padding: '1px 5px', borderRadius: '4px',
                    background: `${p.langColor}25`, color: p.langColor, textTransform: 'uppercase', flexShrink: 0,
                  }}>
                    {p.language}
                  </span>
                  <span style={{
                    fontSize: '12px', fontWeight: isSelected ? 700 : 500,
                    color: isSelected ? '#ffffff' : '#e2e8f0',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {p.name}
                  </span>
                  {p.isUser && (
                    <span style={{
                      fontSize: '9px', fontWeight: 700, color: '#38bdf8',
                      background: '#0284c725', borderRadius: '3px', padding: '0 4px', flexShrink: 0,
                    }}>
                      YOU
                    </span>
                  )}
                </div>

                {/* Bar Graph Track */}
                <div style={{ position: 'relative', height: '14px', background: '#1e293b55', borderRadius: '7px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${widthPct}%`,
                      background: p.isUser
                        ? `linear-gradient(90deg, #38bdf8, #6366f1)`
                        : `linear-gradient(90deg, #64748b, #94a3b8)`,
                      borderRadius: '7px',
                      transition: 'width 0.4s ease-out',
                    }}
                  />
                </div>

                {/* Metric Value */}
                <div style={{ textAlign: 'right', fontSize: '12px', fontWeight: 700, color: '#cbd5e1' }}>
                  {p.execMs} ms
                </div>

                {/* Complexity Pill */}
                <div style={{ textAlign: 'right' }}>
                  <span style={{
                    fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '5px',
                    background: p.complexity === 'O(1)' || p.complexity === 'O(log n)' ? '#10b98125' : p.complexity === 'O(n)' ? '#3b82f625' : '#f59e0b25',
                    color: p.complexity === 'O(1)' || p.complexity === 'O(log n)' ? '#34d399' : p.complexity === 'O(n)' ? '#60a5fa' : '#fbbf24',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    {p.complexity}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Program Detailed Quick-Card */}
        {selected && (
          <div style={{
            marginTop: '8px', padding: '12px 16px', background: '#0b1329',
            border: '1px solid #1e293b', borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: 36, height: 36, borderRadius: '8px', background: `${selected.langColor}20`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: selected.langColor,
              }}>
                {selected.language.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc' }}>{selected.name}</span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>• {selected.lines} lines of code</span>
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                  Time: <strong style={{ color: '#a5b4fc' }}>{selected.complexity}</strong> | Space: <strong style={{ color: '#6ee7b7' }}>{selected.spaceComplexity}</strong> | Memory: <strong>~{selected.memoryKb} KB</strong>
                </div>
              </div>
            </div>

            {onOpenInEditor && (
              <button
                onClick={() => onOpenInEditor(selected)}
                style={{
                  background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
                  color: '#fff', border: 'none', borderRadius: '8px', padding: '6px 14px',
                  fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                  boxShadow: '0 2px 8px rgba(79, 70, 229, 0.4)',
                }}
              >
                <Play size={12} fill="#fff" /> Open in Code Editor
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEW 2: BIG-O GROWTH & SCALABILITY CURVES (Interactive SVG Chart)
// ─────────────────────────────────────────────────────────────────────────────

function BigOGrowthCurvesView({
  programs,
  activeProgram,
  onSelect,
  onOpenInEditor,
}: {
  programs: EnrichedProgram[];
  activeProgram: EnrichedProgram;
  onSelect: (p: EnrichedProgram) => void;
  onOpenInEditor?: (p: SavedProgram) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{
        background: '#090d16', border: '1px solid #1e293b', borderRadius: '12px',
        padding: '16px 18px',
      }}>
        {/* Header Legend */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9' }}>
                Asymptotic Scalability Curves ($N \to \infty$)
              </span>
              {onOpenInEditor && (
                <button
                  onClick={() => onOpenInEditor(activeProgram)}
                  style={{
                    background: '#1e293b', border: '1px solid #334155', color: '#93c5fd',
                    padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 600,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                  }}
                >
                  <Play size={10} /> Test in Editor
                </button>
              )}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
              Active algorithm: <strong style={{ color: '#38bdf8' }}>{activeProgram.name}</strong> ({activeProgram.complexity})
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '11px', fontWeight: 600 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981' }}>
              <span style={{ width: 10, height: 3, background: '#10b981', borderRadius: 2 }} /> O(1) Constant
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#06b6d4' }}>
              <span style={{ width: 10, height: 3, background: '#06b6d4', borderRadius: 2 }} /> O(log n)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#3b82f6' }}>
              <span style={{ width: 10, height: 3, background: '#3b82f6', borderRadius: 2 }} /> O(n) Linear
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#8b5cf6' }}>
              <span style={{ width: 10, height: 3, background: '#8b5cf6', borderRadius: 2 }} /> O(n log n)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#f59e0b' }}>
              <span style={{ width: 10, height: 3, background: '#f59e0b', borderRadius: 2 }} /> O(n²) Quadratic
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ef4444' }}>
              <span style={{ width: 10, height: 3, background: '#ef4444', borderRadius: 2 }} /> O(2ⁿ) Exponential
            </span>
          </div>
        </div>

        {/* SVG Multi-Curve Plot */}
        <div style={{ width: '100%', height: '240px', background: '#030712', borderRadius: '10px', border: '1px solid #111827', position: 'relative', overflow: 'hidden' }}>
          <svg width="100%" height="100%" viewBox="0 0 700 240" preserveAspectRatio="none">
            <defs>
              <linearGradient id="grid-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1e293b" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#0f172a" stopOpacity="0.1" />
              </linearGradient>
            </defs>

            {/* Grid Horizontal */}
            <line x1="50" y1="30" x2="680" y2="30" stroke="#1e293b" strokeDasharray="3,3" />
            <line x1="50" y1="75" x2="680" y2="75" stroke="#1e293b" strokeDasharray="3,3" />
            <line x1="50" y1="120" x2="680" y2="120" stroke="#1e293b" strokeDasharray="3,3" />
            <line x1="50" y1="165" x2="680" y2="165" stroke="#1e293b" strokeDasharray="3,3" />
            <line x1="50" y1="210" x2="680" y2="210" stroke="#334155" strokeWidth="1.5" />

            {/* Grid Vertical */}
            <line x1="50" y1="30" x2="50" y2="210" stroke="#334155" strokeWidth="1.5" />
            <line x1="205" y1="30" x2="205" y2="210" stroke="#1e293b" strokeDasharray="3,3" />
            <line x1="365" y1="30" x2="365" y2="210" stroke="#1e293b" strokeDasharray="3,3" />
            <line x1="520" y1="30" x2="520" y2="210" stroke="#1e293b" strokeDasharray="3,3" />
            <line x1="680" y1="30" x2="680" y2="210" stroke="#1e293b" strokeDasharray="3,3" />

            {/* O(1) Constant (Emerald) */}
            <line x1="50" y1="202" x2="680" y2="202" stroke="#10b981" strokeWidth={activeProgram.complexity === 'O(1)' ? '4' : '2'} opacity={activeProgram.complexity === 'O(1)' ? 1 : 0.6} />

            {/* O(log n) Logarithmic (Cyan) */}
            <path d="M 50,202 Q 220,192 680,175" fill="none" stroke="#06b6d4" strokeWidth={activeProgram.complexity === 'O(log n)' ? '4' : '2'} opacity={activeProgram.complexity === 'O(log n)' ? 1 : 0.6} />

            {/* O(n) Linear (Blue) */}
            <line x1="50" y1="202" x2="680" y2="110" stroke="#3b82f6" strokeWidth={activeProgram.complexity === 'O(n)' ? '4' : '2'} opacity={activeProgram.complexity === 'O(n)' ? 1 : 0.6} />

            {/* O(n log n) (Purple) */}
            <path d="M 50,202 Q 400,165 680,60" fill="none" stroke="#8b5cf6" strokeWidth={activeProgram.complexity === 'O(n log n)' ? '4' : '2'} opacity={activeProgram.complexity === 'O(n log n)' ? 1 : 0.6} />

            {/* O(n²) Quadratic (Amber) */}
            <path d="M 50,202 Q 420,198 680,28" fill="none" stroke="#f59e0b" strokeWidth={activeProgram.complexity === 'O(n²)' ? '4' : '2'} opacity={activeProgram.complexity === 'O(n²)' ? 1 : 0.6} />

            {/* O(2ⁿ) Exponential (Red) */}
            <path d="M 50,202 Q 240,198 380,28" fill="none" stroke="#ef4444" strokeWidth={activeProgram.complexity === 'O(2ⁿ)' ? '4' : '2'} strokeDasharray="4,4" opacity={activeProgram.complexity === 'O(2ⁿ)' ? 1 : 0.5} />

            {/* Active program pinpoint badge */}
            <circle cx="365" cy={activeProgram.complexity === 'O(1)' ? 202 : activeProgram.complexity === 'O(log n)' ? 186 : activeProgram.complexity === 'O(n)' ? 148 : activeProgram.complexity === 'O(n log n)' ? 118 : activeProgram.complexity === 'O(n²)' ? 75 : 35} r="6" fill="#38bdf8" stroke="#ffffff" strokeWidth="2" />

            {/* X-Axis labels */}
            <text x="50" y="226" fill="#94a3b8" fontSize="11" textAnchor="middle">N = 1</text>
            <text x="205" y="226" fill="#94a3b8" fontSize="11" textAnchor="middle">N = 100</text>
            <text x="365" y="226" fill="#94a3b8" fontSize="11" textAnchor="middle">N = 1,000</text>
            <text x="520" y="226" fill="#94a3b8" fontSize="11" textAnchor="middle">N = 10,000</text>
            <text x="670" y="226" fill="#94a3b8" fontSize="11" textAnchor="middle">N = 100,000</text>

            {/* Y-Axis labels */}
            <text x="42" y="206" fill="#64748b" fontSize="10" textAnchor="end">1</text>
            <text x="42" y="165" fill="#64748b" fontSize="10" textAnchor="end">10³</text>
            <text x="42" y="120" fill="#64748b" fontSize="10" textAnchor="end">10⁶</text>
            <text x="42" y="75" fill="#64748b" fontSize="10" textAnchor="end">10⁹</text>
            <text x="42" y="34" fill="#64748b" fontSize="10" textAnchor="end">10¹²</text>
          </svg>
        </div>

        {/* Algorithm Selectors Carousel */}
        <div style={{ marginTop: '14px', display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          {programs.map((p) => {
            const isCur = p.program_id === activeProgram.program_id;
            return (
              <button
                key={p.program_id}
                onClick={() => onSelect(p)}
                style={{
                  background: isCur ? '#1e293b' : '#090d16',
                  border: isCur ? '1px solid #6366f1' : '1px solid #1e293b',
                  borderRadius: '8px', padding: '8px 12px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0,
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: p.langColor }} />
                <span style={{ fontSize: '11px', fontWeight: 600, color: isCur ? '#fff' : '#cbd5e1' }}>
                  {p.name}
                </span>
                <span style={{
                  fontSize: '10px', fontWeight: 700, padding: '1px 5px', borderRadius: '4px',
                  background: isCur ? '#6366f130' : '#1e293b',
                  color: isCur ? '#a5b4fc' : '#94a3b8',
                }}>
                  {p.complexity}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEW 3: COMPLEXITY & RESOURCE DISTRIBUTION BREAKDOWN
// ─────────────────────────────────────────────────────────────────────────────

function ComplexityDistributionView({
  programs,
}: {
  programs: EnrichedProgram[];
  selectedId?: string;
  onSelect?: (p: EnrichedProgram) => void;
}) {
  const timeCounts: Record<string, number> = {};
  const spaceCounts: Record<string, number> = {};

  programs.forEach((p) => {
    timeCounts[p.complexity] = (timeCounts[p.complexity] || 0) + 1;
    spaceCounts[p.spaceComplexity] = (spaceCounts[p.spaceComplexity] || 0) + 1;
  });

  const timeColorMap: Record<string, string> = {
    'O(1)': '#10b981',
    'O(log n)': '#06b6d4',
    'O(n)': '#3b82f6',
    'O(n log n)': '#8b5cf6',
    'O(n²)': '#f59e0b',
    'O(n³)': '#f97316',
    'O(2ⁿ)': '#ef4444',
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
      {/* Time Complexity Distribution */}
      <div style={{ background: '#090d16', border: '1px solid #1e293b', borderRadius: '12px', padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Clock size={15} color="#818cf8" />
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9' }}>
            Time Complexity Distribution
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {Object.entries(timeCounts).map(([comp, count]) => {
            const pct = Math.round((count / programs.length) * 100);
            const color = timeColorMap[comp] || '#6366f1';
            return (
              <div key={comp} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span style={{ fontWeight: 700, color }}>{comp}</span>
                  <span style={{ color: '#94a3b8' }}>{count} ({pct}%)</span>
                </div>
                <div style={{ height: '6px', background: '#1e293b', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '3px' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Space Complexity Distribution */}
      <div style={{ background: '#090d16', border: '1px solid #1e293b', borderRadius: '12px', padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Database size={15} color="#34d399" />
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9' }}>
            Space Complexity &amp; Memory Allocation
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {Object.entries(spaceCounts).map(([comp, count]) => {
            const pct = Math.round((count / programs.length) * 100);
            const color = comp === 'O(1)' ? '#34d399' : comp === 'O(n)' ? '#38bdf8' : '#f59e0b';
            return (
              <div key={comp} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span style={{ fontWeight: 700, color }}>{comp}</span>
                  <span style={{ color: '#94a3b8' }}>{count} ({pct}%)</span>
                </div>
                <div style={{ height: '6px', background: '#1e293b', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '3px' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEW 4: INPUT SIZE SCALABILITY SIMULATOR
// ─────────────────────────────────────────────────────────────────────────────

function ScalabilitySimulatorView({
  programs,
  activeProgram,
  onSelect,
}: {
  programs: EnrichedProgram[];
  activeProgram?: EnrichedProgram;
  onSelect: (p: EnrichedProgram) => void;
}) {
  const [nValue, setNValue] = useState<number>(1000);

  const calculateOps = (complexity: string, n: number): string => {
    if (complexity === 'O(1)') return '1 op';
    if (complexity === 'O(log n)') return `${Math.round(Math.log2(n))} ops`;
    if (complexity === 'O(n)') return `${n.toLocaleString()} ops`;
    if (complexity === 'O(n log n)') return `${Math.round(n * Math.log2(n)).toLocaleString()} ops`;
    if (complexity === 'O(n²)') return `${(n * n).toLocaleString()} ops`;
    if (complexity === 'O(n³)') return `${(n * n * n).toLocaleString()} ops`;
    if (complexity === 'O(2ⁿ)') return n > 40 ? '💥 Exceeds 10¹² ops' : `${Math.pow(2, n).toLocaleString()} ops`;
    return `${n} ops`;
  };

  return (
    <div style={{
      background: '#090d16', border: '1px solid #1e293b', borderRadius: '12px',
      padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '16px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9' }}>
              Input Scale (N) Stress Test Simulator
            </span>
            {activeProgram && (
              <span style={{ fontSize: '11px', color: '#818cf8', background: '#312e8130', padding: '1px 6px', borderRadius: '4px' }}>
                Testing: {activeProgram.name}
              </span>
            )}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
            Drag the slider to see how operation volume scales exponentially or remains constant.
          </div>
        </div>

        {/* Slider Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#38bdf8' }}>
            N = {nValue.toLocaleString()} elements
          </span>
          <input
            type="range"
            min="10"
            max="50000"
            step="50"
            value={nValue}
            onChange={(e) => setNValue(parseInt(e.target.value, 10))}
            style={{ width: '160px', accentColor: '#4f46e5', cursor: 'pointer' }}
          />
        </div>
      </div>

      {/* Simulator Results Table */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
        {programs.slice(0, 6).map((p) => {
          const opsStr = calculateOps(p.complexity, nValue);
          const isWarning = p.complexity === 'O(n²)' && nValue > 10000;
          return (
            <div
              key={p.program_id}
              onClick={() => onSelect(p)}
              style={{
                background: '#0b1329', border: '1px solid #1e293b', borderRadius: '10px',
                padding: '12px 14px', cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#f1f5f9' }}>{p.name}</span>
                <span style={{
                  fontSize: '10px', fontWeight: 800, padding: '1px 6px', borderRadius: '4px',
                  background: `${p.langColor}20`, color: p.langColor,
                }}>
                  {p.complexity}
                </span>
              </div>
              <div style={{
                fontSize: '14px', fontWeight: 800,
                color: isWarning ? '#ef4444' : '#34d399',
              }}>
                {opsStr}
              </div>
              <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                {isWarning ? '⚠️ Significant CPU throttle likely at this scale' : '✓ Acceptable execution threshold'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
