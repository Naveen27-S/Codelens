/**
 * ProgramPerformanceModal.tsx
 *
 * Performance Graph & Complexity Modal for Saved Programs in Dashboard History.
 * Displays:
 *  - Time Complexity & Space Complexity breakdown
 *  - Theoretical Input Growth Curve (O(1), O(log n), O(n), O(n log n), O(n²))
 *  - Execution Metrics (Execution time, memory estimate, lines of code)
 *  - Comparison with alternative solutions
 *  - Optimization techniques
 *  - Quick "Open in Editor & Analyze" action
 */

import { useState, useMemo } from 'react';
import {
  X, Zap, Clock, Database, TrendingUp, Lightbulb, Play,
  CheckCircle2, Code2, BarChart2
} from 'lucide-react';
import type { SavedProgram } from '../../services/dashboardService';

interface Props {
  program: SavedProgram;
  onClose: () => void;
  onOpenInEditor?: (p: SavedProgram) => void;
}

// ─── Complexity Estimator ───────────────────────────────────────────────────

function estimateComplexity(code: string, _language: string) {
  const lines = (code || '').split('\n');
  const codeText = code || '';

  // Count loops
  const loopMatches = codeText.match(/\b(for|while|do)\b/g) || [];
  let depth = 0;
  let maxDepth = 0;
  for (const line of lines) {
    if (/\b(for|while|do)\b/.test(line)) {
      depth++;
      if (depth > maxDepth) maxDepth = depth;
    }
    const opens = (line.match(/\{/g) || []).length;
    const closes = (line.match(/\}/g) || []).length;
    if (closes > opens) depth = Math.max(0, depth - (closes - opens));
  }

  const hasSort = /sort|sorted|Arrays\.sort|std::sort|qsort/i.test(codeText);
  const hasRecursion = /\b(\w+)\s*\([^)]*\)[\s\S]*?\1\s*\(/.test(codeText);
  const hasBinarySearch = /binary.*search|bisect|low.*high/i.test(codeText);

  let timeComplexity = 'O(1)';
  let timeLabel = 'Constant Time';
  let timeType: 'constant' | 'log' | 'linear' | 'linearithmic' | 'quadratic' | 'cubic' | 'exponential' = 'constant';
  let score = 95;

  if (hasRecursion && /return.*\+.*\(/.test(codeText)) {
    timeComplexity = 'O(2ⁿ)';
    timeLabel = 'Exponential';
    timeType = 'exponential';
    score = 25;
  } else if (maxDepth >= 3) {
    timeComplexity = 'O(n³)';
    timeLabel = 'Cubic';
    timeType = 'cubic';
    score = 40;
  } else if (maxDepth === 2) {
    timeComplexity = 'O(n²)';
    timeLabel = 'Quadratic';
    timeType = 'quadratic';
    score = 60;
  } else if (hasSort) {
    timeComplexity = 'O(n log n)';
    timeLabel = 'Linearithmic';
    timeType = 'linearithmic';
    score = 75;
  } else if (maxDepth === 1 || loopMatches.length > 0) {
    timeComplexity = 'O(n)';
    timeLabel = 'Linear';
    timeType = 'linear';
    score = 85;
  } else if (hasBinarySearch) {
    timeComplexity = 'O(log n)';
    timeLabel = 'Logarithmic';
    timeType = 'log';
    score = 92;
  }

  // Space complexity
  const hasDynamicAlloc = /new\s+|malloc|calloc|vector|ArrayList|HashMap|HashSet|append|push/i.test(codeText);
  const hasMatrix = /\[\s*\]\s*\[\s*\]|vector<vector|List<List/.test(codeText);
  let spaceComplexity = 'O(1)';
  let spaceLabel = 'Constant Space';
  if (hasMatrix) {
    spaceComplexity = 'O(n²)';
    spaceLabel = 'Quadratic Space';
  } else if (hasDynamicAlloc || hasRecursion) {
    spaceComplexity = 'O(n)';
    spaceLabel = 'Linear Space';
  }

  return { timeComplexity, timeLabel, timeType, spaceComplexity, spaceLabel, score, maxDepth, hasSort };
}

export function ProgramPerformanceModal({ program, onClose, onOpenInEditor }: Props) {
  const [activeTab, setActiveTab] = useState<'graph' | 'alternatives' | 'techniques'>('graph');

  const analysis = useMemo(() => {
    return estimateComplexity(program.code || '', program.language || '');
  }, [program.code, program.language]);

  // Extract execution time if recorded in output
  const execTimeMatch = (program.output || '').match(/Time:\s*(\d+)\s*ms/i);
  const execTimeMs = execTimeMatch ? parseInt(execTimeMatch[1], 10) : 1;
  const lineCount = (program.code || '').split('\n').filter((l: string) => l.trim().length > 0).length;

  return (
    <div
      className="sp-modal-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(5, 7, 15, 0.85)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        className="sp-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '780px', maxHeight: '90vh',
          background: '#0d1322', border: '1px solid #1e293b',
          borderRadius: '16px', display: 'flex', flexDirection: 'column',
          overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '18px 24px', borderBottom: '1px solid #1e293b',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'linear-gradient(180deg, #131b2e 0%, #0d1322 100%)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '38px', height: '38px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 20px rgba(99, 102, 241, 0.35)',
            }}>
              <TrendingUp size={20} color="#fff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#f8fafc' }}>
                  {program.name || 'Program Performance Analysis'}
                </h3>
                <span style={{
                  fontSize: '11px', fontWeight: 600, textTransform: 'uppercase',
                  padding: '2px 8px', borderRadius: '6px',
                  background: '#1e293b', color: '#94a3b8', border: '1px solid #334155',
                }}>
                  {program.language}
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                Theoretical Time & Space Complexity • Growth Graphs • Optimization Techniques
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', color: '#94a3b8',
              cursor: 'pointer', padding: '6px', borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Top KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
            {/* Time Complexity */}
            <div style={{
              background: '#090d16', border: '1px solid #1e293b', borderRadius: '12px',
              padding: '12px 14px', position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#818cf8', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>
                <Clock size={13} /> Time Complexity
              </div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#a5b4fc', marginTop: '6px' }}>
                {analysis.timeComplexity}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                {analysis.timeLabel}
              </div>
            </div>

            {/* Space Complexity */}
            <div style={{
              background: '#090d16', border: '1px solid #1e293b', borderRadius: '12px',
              padding: '12px 14px', position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#34d399', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>
                <Database size={13} /> Space Complexity
              </div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#6ee7b7', marginTop: '6px' }}>
                {analysis.spaceComplexity}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                {analysis.spaceLabel}
              </div>
            </div>

            {/* Execution Speed */}
            <div style={{
              background: '#090d16', border: '1px solid #1e293b', borderRadius: '12px',
              padding: '12px 14px', position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fbbf24', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>
                <Zap size={13} /> Recorded Time
              </div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#fde68a', marginTop: '6px' }}>
                {execTimeMs} ms
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                Client In-Browser Runner
              </div>
            </div>

            {/* Performance Score */}
            <div style={{
              background: '#090d16', border: '1px solid #1e293b', borderRadius: '12px',
              padding: '12px 14px', position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f43f5e', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>
                <BarChart2 size={13} /> Health Score
              </div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: analysis.score >= 70 ? '#4ade80' : '#fbbf24', marginTop: '6px' }}>
                {analysis.score} / 100
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                {lineCount} lines of code
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #1e293b', paddingBottom: '8px' }}>
            <button
              onClick={() => setActiveTab('graph')}
              style={{
                background: activeTab === 'graph' ? '#1e293b' : 'transparent',
                color: activeTab === 'graph' ? '#f8fafc' : '#94a3b8',
                border: 'none', padding: '6px 14px', borderRadius: '8px',
                fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}
            >
              <TrendingUp size={14} /> Performance Growth Graph
            </button>
            <button
              onClick={() => setActiveTab('alternatives')}
              style={{
                background: activeTab === 'alternatives' ? '#1e293b' : 'transparent',
                color: activeTab === 'alternatives' ? '#f8fafc' : '#94a3b8',
                border: 'none', padding: '6px 14px', borderRadius: '8px',
                fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}
            >
              <Code2 size={14} /> Alternative Solutions
            </button>
            <button
              onClick={() => setActiveTab('techniques')}
              style={{
                background: activeTab === 'techniques' ? '#1e293b' : 'transparent',
                color: activeTab === 'techniques' ? '#f8fafc' : '#94a3b8',
                border: 'none', padding: '6px 14px', borderRadius: '8px',
                fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}
            >
              <Lightbulb size={14} /> Optimization Techniques
            </button>
          </div>

          {/* TAB 1: Performance Growth Graph */}
          {activeTab === 'graph' && (
            <div style={{ background: '#090d16', border: '1px solid #1e293b', borderRadius: '12px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9' }}>
                    Theoretical Operations vs Input Size (N)
                  </span>
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b' }}>
                    Comparing current algorithm growth with common complexity bounds
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '12px', fontSize: '11px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#6366f1' }}>
                    ● Current ({analysis.timeComplexity})
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981' }}>
                    ● Optimal (O(n) / O(log n))
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ef4444' }}>
                    ● Inefficient (O(n²))
                  </span>
                </div>
              </div>

              {/* SVG Curve Chart */}
              <div style={{ width: '100%', height: '170px' }}>
                <svg width="100%" height="100%" viewBox="0 0 600 170" preserveAspectRatio="none">
                  {/* Grid Lines */}
                  <line x1="40" y1="20" x2="580" y2="20" stroke="#1e293b" strokeDasharray="3,3" />
                  <line x1="40" y1="60" x2="580" y2="60" stroke="#1e293b" strokeDasharray="3,3" />
                  <line x1="40" y1="100" x2="580" y2="100" stroke="#1e293b" strokeDasharray="3,3" />
                  <line x1="40" y1="140" x2="580" y2="140" stroke="#334155" />
                  <line x1="40" y1="20" x2="40" y2="140" stroke="#334155" />

                  {/* Y Axis labels */}
                  <text x="30" y="24" fill="#64748b" fontSize="10" textAnchor="end">10⁴</text>
                  <text x="30" y="64" fill="#64748b" fontSize="10" textAnchor="end">10³</text>
                  <text x="30" y="104" fill="#64748b" fontSize="10" textAnchor="end">10²</text>
                  <text x="30" y="144" fill="#64748b" fontSize="10" textAnchor="end">0</text>

                  {/* Curve 1: O(n) Optimal (Green) */}
                  <path d="M 40,138 Q 300,100 580,70" fill="none" stroke="#10b981" strokeWidth="2.5" />

                  {/* Curve 2: O(n²) Inefficient (Red) */}
                  <path d="M 40,138 Q 300,135 580,22" fill="none" stroke="#ef4444" strokeWidth="2" strokeDasharray="4,4" />

                  {/* Curve 3: Current Selected Algorithm (Indigo highlighted) */}
                  {analysis.timeType === 'quadratic' ? (
                    <path d="M 40,138 Q 300,135 580,22" fill="none" stroke="#6366f1" strokeWidth="3.5" />
                  ) : analysis.timeType === 'linearithmic' ? (
                    <path d="M 40,138 Q 300,115 580,48" fill="none" stroke="#6366f1" strokeWidth="3.5" />
                  ) : analysis.timeType === 'constant' ? (
                    <path d="M 40,136 L 580,136" fill="none" stroke="#6366f1" strokeWidth="3.5" />
                  ) : (
                    <path d="M 40,138 Q 300,100 580,70" fill="none" stroke="#6366f1" strokeWidth="3.5" />
                  )}

                  {/* X Axis Points */}
                  <text x="40" y="156" fill="#64748b" fontSize="10" textAnchor="middle">N=10</text>
                  <text x="175" y="156" fill="#64748b" fontSize="10" textAnchor="middle">N=100</text>
                  <text x="310" y="156" fill="#64748b" fontSize="10" textAnchor="middle">N=1,000</text>
                  <text x="445" y="156" fill="#64748b" fontSize="10" textAnchor="middle">N=5,000</text>
                  <text x="580" y="156" fill="#64748b" fontSize="10" textAnchor="middle">N=10,000</text>
                </svg>
              </div>

              {/* Explanation Note */}
              <div style={{ marginTop: '12px', padding: '10px 12px', background: '#0d1322', borderRadius: '8px', border: '1px solid #1e293b', fontSize: '11px', color: '#94a3b8', lineHeight: 1.5 }}>
                <strong style={{ color: '#cbd5e1' }}>Analysis Summary: </strong>
                This {program.language?.toUpperCase()} algorithm runs in <strong>{analysis.timeComplexity}</strong> time.
                {analysis.maxDepth >= 2
                  ? ' Because it contains nested iteration, execution operations will scale quadratically with large datasets.'
                  : ' Its computational workload scales smoothly with input size, making it suitable for moderate to large workloads.'}
              </div>
            </div>
          )}

          {/* TAB 2: Alternative Solutions */}
          {activeTab === 'alternatives' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{
                background: '#090d16', border: '1px solid #1e293b', borderRadius: '10px',
                padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc' }}>
                    Current Implementation
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                    Algorithm as stored in your dashboard history
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', fontSize: '11px', fontWeight: 600 }}>
                  <span style={{ padding: '3px 8px', borderRadius: '4px', background: '#1e293b', color: '#a5b4fc' }}>
                    Time: {analysis.timeComplexity}
                  </span>
                  <span style={{ padding: '3px 8px', borderRadius: '4px', background: '#1e293b', color: '#6ee7b7' }}>
                    Space: {analysis.spaceComplexity}
                  </span>
                </div>
              </div>

              {/* Alternative 1: Optimized Map / Set */}
              <div style={{
                background: '#090d16', border: '1px solid #334155', borderRadius: '10px',
                padding: '12px 14px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle2 size={16} color="#10b981" />
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#10b981' }}>
                      Recommended: Hash Map / Lookup Table Optimization
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', fontSize: '11px', fontWeight: 600 }}>
                    <span style={{ padding: '3px 8px', borderRadius: '4px', background: '#064e3b', color: '#6ee7b7' }}>
                      Time: O(n)
                    </span>
                    <span style={{ padding: '3px 8px', borderRadius: '4px', background: '#1e293b', color: '#94a3b8' }}>
                      Space: O(n)
                    </span>
                  </div>
                </div>
                <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#94a3b8', lineHeight: 1.5 }}>
                  Trades linear auxiliary memory to achieve constant O(1) lookups per element, eliminating nested loops entirely.
                </p>
              </div>

              {/* Alternative 2: Two-Pointer In-Place */}
              <div style={{
                background: '#090d16', border: '1px solid #1e293b', borderRadius: '10px',
                padding: '12px 14px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Lightbulb size={16} color="#fbbf24" />
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#fbbf24' }}>
                      In-Place Two-Pointer Strategy
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', fontSize: '11px', fontWeight: 600 }}>
                    <span style={{ padding: '3px 8px', borderRadius: '4px', background: '#1e293b', color: '#fde68a' }}>
                      Time: O(n log n)
                    </span>
                    <span style={{ padding: '3px 8px', borderRadius: '4px', background: '#064e3b', color: '#6ee7b7' }}>
                      Space: O(1)
                    </span>
                  </div>
                </div>
                <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#94a3b8', lineHeight: 1.5 }}>
                  Sorts the array once and performs inward scans. Keeps extra memory strictly at O(1) without requiring hash tables.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: Optimization Techniques */}
          {activeTab === 'techniques' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                {
                  title: 'Early Exit Guards',
                  desc: 'Add early boundary checks (`if (n <= 1) return;`) to eliminate unnecessary loop iterations on edge cases.',
                },
                {
                  title: 'In-Place Transformations',
                  desc: 'Modify input data structures directly instead of copying arrays to keep space complexity at O(1).',
                },
                {
                  title: 'Primitive Types Over Objects',
                  desc: 'In Java/C++, use primitive arrays (`int[]`) rather than wrapper object collections (`ArrayList<Integer>`) to reduce GC pressure and memory footprint.',
                },
                {
                  title: 'Pre-Sizing Capacities',
                  desc: 'When allocating lists or hash maps, specify the initial capacity up front to avoid continuous dynamic reallocation.',
                },
              ].map((tech, idx) => (
                <div key={idx} style={{
                  background: '#090d16', border: '1px solid #1e293b', borderRadius: '8px',
                  padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: '10px',
                }}>
                  <div style={{
                    width: '20px', height: '20px', borderRadius: '50%',
                    background: '#6366f120', color: '#818cf8', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontSize: '11px',
                    fontWeight: 700, flexShrink: 0, marginTop: '2px',
                  }}>
                    {idx + 1}
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#f1f5f9' }}>
                      {tech.title}
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', lineHeight: 1.4 }}>
                      {tech.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px', borderTop: '1px solid #1e293b',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: '#090d16',
        }}>
          <span style={{ fontSize: '11px', color: '#64748b' }}>
            ID: {program.program_id} • Status: {program.status || 'Active'}
          </span>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '7px 16px', borderRadius: '8px', background: '#1e293b',
                color: '#cbd5e1', border: 'none', fontSize: '12px', fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
            {onOpenInEditor && (
              <button
                onClick={() => {
                  onClose();
                  onOpenInEditor(program);
                }}
                style={{
                  padding: '7px 16px', borderRadius: '8px',
                  background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                  color: '#fff', border: 'none', fontSize: '12px', fontWeight: 600,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                }}
              >
                <Play size={13} fill="currentColor" /> Open in Editor & Analyze
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
