/**
 * PersonalizedRecommendationsCard.tsx
 *
 * Personalized Learning Recommendation Engine for CodeLens AI.
 * Uses learning history to recommend:
 *  1. Topics to study next (guided DSA curriculum roadmap)
 *  2. Weak programming concepts (detected from real execution mistakes & runtime errors)
 *  3. Practice questions tailored to skill level
 *  4. Coding challenges based on skill level with Big-O constraints
 */

import { useState, useEffect } from 'react';
import {
  BrainCircuit, Compass, AlertTriangle, Code2, Trophy,
  ChevronRight, Play, RefreshCw, CheckCircle2,
  Clock, Zap, BookOpen, Target
} from 'lucide-react';
import {
  fetchPersonalizedRecommendations,
  type PersonalizedRecommendationsResponse,
  type TopicToStudyItem,
  type WeakConceptItem,
  type PracticeQuestionItem,
  type CodingChallengeItem,
} from '../../services/dashboardService';

interface Props {
  onOpenQuestionInEditor?: (code: string, language: string, title: string) => void;
}

export function PersonalizedRecommendationsCard({ onOpenQuestionInEditor }: Props) {
  const [data, setData] = useState<PersonalizedRecommendationsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'topics' | 'weaknesses' | 'questions' | 'challenges'>('topics');

  const loadRecommendations = () => {
    setLoading(true);
    fetchPersonalizedRecommendations()
      .then((res) => {
        setData(res);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadRecommendations();
  }, []);

  if (loading && !data) {
    return (
      <div className="dash-card" style={{ marginBottom: '24px', padding: '32px', textAlign: 'center', color: '#64748b' }}>
        <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px', color: '#6366f1' }} />
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#cbd5e1' }}>
          Personalized Learning Recommendation Engine is analyzing your coding history...
        </div>
      </div>
    );
  }

  const recs = data!;
  const skillColor = recs.skill_level === 'Advanced' ? '#a855f7' : recs.skill_level === 'Intermediate' ? '#3b82f6' : '#10b981';

  return (
    <div id="personalized-recommendations-section" className="dash-card" style={{ marginBottom: '24px', overflow: 'hidden' }}>
      {/* ── Top Header & Skill Profiler ────────────────────────────────────── */}
      <div className="dash-card-title" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid #1e293b', paddingBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
            padding: '7px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
          }}>
            <BrainCircuit size={17} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.01em' }}>
                Personalized Learning Recommendation Engine
              </span>
              <span style={{
                fontSize: '11px', fontWeight: 700,
                color: skillColor, background: `${skillColor}20`,
                border: `1px solid ${skillColor}50`, borderRadius: '999px', padding: '1px 8px',
              }}>
                {recs.skill_level} Level
              </span>
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
              {recs.summary}
            </div>
          </div>
        </div>

        {/* Skill Score Pill & Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            background: '#090d16', border: '1px solid #1e293b',
            borderRadius: '10px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>Proficiency Score:</span>
            <span style={{ fontSize: '14px', fontWeight: 800, color: skillColor }}>{recs.skill_score}/100</span>
          </div>

          <button
            onClick={loadRecommendations}
            title="Re-analyze history & refresh recommendations"
            style={{
              background: '#090d16', border: '1px solid #1e293b', borderRadius: '8px',
              padding: '6px', color: '#94a3b8', cursor: 'pointer',
            }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── Sub-Navigation Tabs ────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: '6px', padding: '12px 0', borderBottom: '1px solid #1e293b',
        overflowX: 'auto', flexWrap: 'wrap',
      }}>
        <button
          onClick={() => setActiveTab('topics')}
          style={{
            fontSize: '12px', padding: '6px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
            background: activeTab === 'topics' ? '#4f46e5' : '#090d16',
            color: activeTab === 'topics' ? '#fff' : '#94a3b8', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s',
          }}
        >
          <Compass size={13} />
          <span>Topics to Study Next ({recs.topics_to_study.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('weaknesses')}
          style={{
            fontSize: '12px', padding: '6px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
            background: activeTab === 'weaknesses' ? '#4f46e5' : '#090d16',
            color: activeTab === 'weaknesses' ? '#fff' : '#94a3b8', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s',
          }}
        >
          <AlertTriangle size={13} color={activeTab === 'weaknesses' ? '#fff' : '#f59e0b'} />
          <span>Weak Programming Concepts ({recs.weak_concepts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('questions')}
          style={{
            fontSize: '12px', padding: '6px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
            background: activeTab === 'questions' ? '#4f46e5' : '#090d16',
            color: activeTab === 'questions' ? '#fff' : '#94a3b8', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s',
          }}
        >
          <Code2 size={13} />
          <span>Practice Questions ({recs.practice_questions.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('challenges')}
          style={{
            fontSize: '12px', padding: '6px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
            background: activeTab === 'challenges' ? '#4f46e5' : '#090d16',
            color: activeTab === 'challenges' ? '#fff' : '#94a3b8', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s',
          }}
        >
          <Trophy size={13} color={activeTab === 'challenges' ? '#fff' : '#fbbf24'} />
          <span>Coding Challenges ({recs.coding_challenges.length})</span>
        </button>
      </div>

      {/* ── Tab Content Views ─────────────────────────────────────────────── */}
      <div style={{ paddingTop: '16px' }}>
        {activeTab === 'topics' && (
          <TopicsView topics={recs.topics_to_study} onOpen={onOpenQuestionInEditor} />
        )}

        {activeTab === 'weaknesses' && (
          <WeakConceptsView weaknesses={recs.weak_concepts} onOpen={onOpenQuestionInEditor} />
        )}

        {activeTab === 'questions' && (
          <PracticeQuestionsView questions={recs.practice_questions} onOpen={onOpenQuestionInEditor} />
        )}

        {activeTab === 'challenges' && (
          <ChallengesView challenges={recs.coding_challenges} onOpen={onOpenQuestionInEditor} />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. TOPICS TO STUDY NEXT VIEW
// ─────────────────────────────────────────────────────────────────────────────

function TopicsView({
  topics,
  onOpen,
}: {
  topics: TopicToStudyItem[];
  onOpen?: (code: string, language: string, title: string) => void;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
      {topics.map((t) => {
        const diffColor = t.difficulty === 'Beginner' ? '#10b981' : t.difficulty === 'Intermediate' ? '#3b82f6' : '#a855f7';
        return (
          <div
            key={t.id}
            style={{
              background: '#090d16', border: '1px solid #1e293b', borderRadius: '12px',
              padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              transition: 'all 0.2s ease', position: 'relative', overflow: 'hidden',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '20px' }}>{t.icon}</span>
                <span style={{
                  fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px',
                  background: `${diffColor}20`, color: diffColor, border: `1px solid ${diffColor}40`,
                }}>
                  {t.difficulty}
                </span>
              </div>

              <div style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', marginBottom: '6px' }}>
                {t.topic}
              </div>

              <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: '1.45', marginBottom: '10px' }}>
                {t.reason}
              </div>

              <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <BookOpen size={12} />
                <span>Prereq: <strong style={{ color: '#cbd5e1' }}>{t.prerequisites}</strong></span>
              </div>

              <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={12} />
                <span>Est. Time: <strong style={{ color: '#cbd5e1' }}>~{t.estimated_hours} hours</strong></span>
              </div>
            </div>

            <button
              onClick={() => {
                if (onOpen) {
                  onOpen(
                    `// Practice topic: ${t.topic}\n// Recommended by Personalized Learning Engine\n\npublic class Solution {\n    public static void main(String[] args) {\n        System.out.println("Exploring: ${t.topic}");\n    }\n}\n`,
                    'java',
                    t.topic
                  );
                }
              }}
              style={{
                marginTop: '14px', width: '100%',
                background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9',
                borderRadius: '8px', padding: '8px', fontSize: '11px', fontWeight: 600,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#334155'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#1e293b'; }}
            >
              <Target size={12} color="#818cf8" />
              <span>Explore Topic in Editor</span>
              <ChevronRight size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. WEAK PROGRAMMING CONCEPTS VIEW
// ─────────────────────────────────────────────────────────────────────────────

function WeakConceptsView({
  weaknesses,
  onOpen,
}: {
  weaknesses: WeakConceptItem[];
  onOpen?: (code: string, language: string, title: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ fontSize: '12px', color: '#94a3b8' }}>
        Identified from your execution errors, AI debugger sessions, and code complexity history:
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px' }}>
        {weaknesses.map((w) => {
          const sevColor = w.severity === 'High' ? '#ef4444' : w.severity === 'Medium' ? '#f59e0b' : '#3b82f6';

          return (
            <div
              key={w.id}
              style={{
                background: '#090d16', border: '1px solid #1e293b', borderRadius: '12px',
                padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                position: 'relative', overflow: 'hidden',
              }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: sevColor }} />

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                    {w.category}
                  </span>
                  <span style={{
                    fontSize: '10px', fontWeight: 800, padding: '2px 8px', borderRadius: '6px',
                    background: `${sevColor}20`, color: sevColor, border: `1px solid ${sevColor}40`,
                  }}>
                    {w.severity} Severity
                  </span>
                </div>

                <div style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', marginBottom: '6px' }}>
                  {w.concept}
                </div>

                {/* Diagnostic message */}
                <div style={{
                  background: '#0e1628', border: '1px solid #1e293b', borderRadius: '8px',
                  padding: '8px 10px', fontSize: '11px', color: '#cbd5e1', marginBottom: '10px',
                  display: 'flex', alignItems: 'flex-start', gap: '6px',
                }}>
                  <AlertTriangle size={13} color={sevColor} style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <strong style={{ color: '#f8fafc' }}>Diagnostic:</strong> {w.diagnostic}
                  </div>
                </div>

                {/* Remedial Tip */}
                <div style={{
                  background: '#064e3b15', border: '1px solid #05966940', borderRadius: '8px',
                  padding: '8px 10px', fontSize: '11px', color: '#a7f3d0', marginBottom: '12px',
                  display: 'flex', alignItems: 'flex-start', gap: '6px',
                }}>
                  <CheckCircle2 size={13} color="#34d399" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <strong style={{ color: '#34d399' }}>Rule of Thumb:</strong> {w.remedial_tip}
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  if (onOpen) {
                    onOpen(
                      `// Targeted practice to eliminate: ${w.concept}\n// Recommended by Personalized Recommendation Engine\n\npublic class PracticeSolution {\n    public static void main(String[] args) {\n        // Apply rule of thumb: ${w.remedial_tip}\n        System.out.println("Practicing: ${w.concept}");\n    }\n}\n`,
                      'java',
                      w.concept
                    );
                  }
                }}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #312e81 0%, #1e1b4b 100%)',
                  border: '1px solid #4338ca', color: '#c7d2fe',
                  borderRadius: '8px', padding: '8px', fontSize: '11px', fontWeight: 700,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                }}
              >
                <Zap size={12} color="#a5b4fc" />
                <span>Practice Weak Concept in Editor</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. PRACTICE QUESTIONS VIEW
// ─────────────────────────────────────────────────────────────────────────────

function PracticeQuestionsView({
  questions,
  onOpen,
}: {
  questions: PracticeQuestionItem[];
  onOpen?: (code: string, language: string, title: string) => void;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }}>
      {questions.map((q) => {
        const diffColor = q.difficulty === 'Easy' ? '#10b981' : q.difficulty === 'Medium' ? '#f59e0b' : '#ef4444';

        return (
          <div
            key={q.id}
            style={{
              background: '#090d16', border: '1px solid #1e293b', borderRadius: '12px',
              padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8' }}>
                  {q.topic}
                </span>
                <span style={{
                  fontSize: '10px', fontWeight: 800, padding: '2px 8px', borderRadius: '6px',
                  background: `${diffColor}20`, color: diffColor, border: `1px solid ${diffColor}40`,
                }}>
                  {q.difficulty}
                </span>
              </div>

              <div style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', marginBottom: '6px' }}>
                {q.title}
              </div>

              <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: '1.45', marginBottom: '10px' }}>
                {q.description}
              </div>

              <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                <Clock size={12} />
                <span>Est: {q.time_estimate_mins} mins</span>
                <span>•</span>
                <span style={{ textTransform: 'uppercase', color: '#a5b4fc', fontWeight: 700 }}>{q.language}</span>
              </div>
            </div>

            <button
              onClick={() => {
                if (onOpen) onOpen(q.starter_code, q.language, q.title);
              }}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
                border: 'none', color: '#ffffff',
                borderRadius: '8px', padding: '8px', fontSize: '11px', fontWeight: 700,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                boxShadow: '0 2px 8px rgba(79, 70, 229, 0.35)',
              }}
            >
              <Play size={12} fill="#fff" />
              <span>Solve Question in Editor</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. CODING CHALLENGES VIEW
// ─────────────────────────────────────────────────────────────────────────────

function ChallengesView({
  challenges,
  onOpen,
}: {
  challenges: CodingChallengeItem[];
  onOpen?: (code: string, language: string, title: string) => void;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }}>
      {challenges.map((c) => {
        return (
          <div
            key={c.id}
            style={{
              background: '#0b1329', border: '1px solid #1e293b', borderRadius: '12px',
              padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Trophy size={14} color="#fbbf24" />
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#fbbf24' }}>
                    +{c.xp_points} XP Challenge
                  </span>
                </div>
                <span style={{
                  fontSize: '10px', fontWeight: 800, padding: '2px 8px', borderRadius: '6px',
                  background: '#6366f120', color: '#818cf8', border: '1px solid #6366f140',
                }}>
                  {c.skill_level}
                </span>
              </div>

              <div style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', marginBottom: '6px' }}>
                {c.title}
              </div>

              <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: '1.45', marginBottom: '12px' }}>
                {c.description}
              </div>

              {/* Target Big-O constraints strip */}
              <div style={{
                background: '#090d16', border: '1px solid #1e293b', borderRadius: '8px',
                padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: '14px',
              }}>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                  Target Time: <strong style={{ color: '#38bdf8' }}>{c.target_time_complexity}</strong>
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                  Target Space: <strong style={{ color: '#34d399' }}>{c.target_space_complexity}</strong>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                if (onOpen) onOpen(c.starter_code, c.language, c.title);
              }}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                border: 'none', color: '#ffffff',
                borderRadius: '8px', padding: '8px', fontSize: '11px', fontWeight: 700,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                boxShadow: '0 2px 8px rgba(217, 119, 6, 0.35)',
              }}
            >
              <Play size={12} fill="#fff" />
              <span>Launch Challenge in Editor</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
