import { Link } from 'react-router-dom'
import {
  Flame, Mic, Brain, ArrowRight, Sparkles, MessageSquare, Layers, FileText,
  GitBranch, AlertTriangle, Lightbulb, Hash, BookOpen, Quote, Info, Route,
  ListChecks, MousePointerClick, MoveVertical, RefreshCw, Gauge, ShieldCheck,
  GraduationCap, Wrench,
} from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-orange-950/20 via-transparent to-transparent" />
        <div className="max-w-5xl mx-auto px-6 sm:px-8 pt-20 sm:pt-24 pb-16 relative">
          <div className="flex items-center gap-2 text-sm text-orange-400 mb-6">
            <Flame className="w-4 h-4" />
            <span className="font-medium tracking-wide">Forge</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight mb-6">
            One conversation with an expert.<br />
            <span className="text-orange-400">A course anyone can learn from.</span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mb-10 leading-relaxed">
            Forge interviews experts the way a great journalist would, distills what they
            know into a living knowledge base, and turns it into interactive tools and
            personalized learning paths. No forms. No manuals. Just speak.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <Link
              to="/workspaces"
              className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 transition-colors font-medium text-lg"
            >
              Create your Forge
              <ArrowRight className="w-5 h-5" />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-2 px-6 py-3 border border-slate-600 hover:border-slate-500 text-slate-300 hover:text-white transition-colors font-medium"
            >
              See how it works
            </a>
          </div>
        </div>
      </section>

      {/* Problem Statement */}
      <section className="max-w-5xl mx-auto px-6 sm:px-8 py-12">
        <div className="bg-slate-800/50 border border-slate-700/50 p-6 sm:p-8">
          <p className="text-slate-300 leading-relaxed text-lg">
            Expert knowledge is one of the most powerful things in the world — and one of the
            hardest to share. An experienced food bank operator knows exactly how to feed 500
            families a week. A master baker can diagnose sourdough problems by feel. A seasoned
            engineer knows which corners you can cut and which will collapse.
          </p>
          <p className="text-slate-400 mt-4 leading-relaxed">
            That knowledge is locked in their heads, and it rarely survives the trip into a
            PDF nobody reads. Forge gets it out through conversation — and delivers it the way
            people actually learn: a little at a time, with practice, in the expert's own words.
          </p>
        </div>
      </section>

      {/* Two sides */}
      <section className="max-w-5xl mx-auto px-6 sm:px-8 py-12">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-slate-800/40 border border-slate-700/40 p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-orange-500/10 text-orange-400"><Wrench className="w-5 h-5" /></div>
              <h2 className="text-xl font-bold">For experts</h2>
            </div>
            <p className="text-slate-400 leading-relaxed mb-4">
              Talk for half an hour — voice or text. Forge plans the interview around
              <em className="text-slate-300 not-italic font-medium"> your</em> specialisms,
              probes for the judgment calls and hard-won warnings generic advice misses, and
              builds a curated knowledge base you can keep growing with follow-up sessions.
            </p>
            <ul className="space-y-2 text-sm text-slate-400">
              <Bullet>An AI interviewer that adapts to what makes your approach different</Bullet>
              <Bullet>Every insight captured as structured, reusable knowledge</Bullet>
              <Bullet>One link shares everything — no accounts needed for your audience</Bullet>
            </ul>
          </div>
          <div className="bg-slate-800/40 border border-slate-700/40 p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-orange-500/10 text-orange-400"><GraduationCap className="w-5 h-5" /></div>
              <h2 className="text-xl font-bold">For learners</h2>
            </div>
            <p className="text-slate-400 leading-relaxed mb-4">
              Pick a goal, a pace, and the areas you care about. Forge builds you a personal
              learning path — bite-sized lessons and real practice, generated from what the
              expert actually said, at 5, 15, or 30 minutes a day.
            </p>
            <ul className="space-y-2 text-sm text-slate-400">
              <Bullet>Lessons in the expert's own voice, numbers, and examples</Bullet>
              <Bullet>Exercises built from the mistakes the expert has seen people make</Bullet>
              <Bullet>Checkpoints that revisit exactly what you got wrong</Bullet>
            </ul>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="max-w-5xl mx-auto px-6 sm:px-8 py-16">
        <h2 className="text-2xl font-bold mb-3 text-center">How Forge works</h2>
        <p className="text-slate-400 text-center mb-12 max-w-2xl mx-auto">
          From one conversation to a whole way of learning.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <Step
            icon={<Mic className="w-6 h-6" />}
            number="1"
            title="Speak your knowledge"
            description="An AI interviewer draws out what you know — the steps, the judgment calls, the things that go wrong. Voice or text."
          />
          <Step
            icon={<Brain className="w-6 h-6" />}
            number="2"
            title="Knowledge, distilled"
            description="As you talk, every fact, procedure, warning, and rule of thumb is captured, typed, and confidence-scored into a curated knowledge base."
          />
          <Step
            icon={<Sparkles className="w-6 h-6" />}
            number="3"
            title="An interactive toolkit"
            description="Decision trees, checklists, calculators, and an ask-the-expert chat — generated from the knowledge, ready to share with one link."
          />
          <Step
            icon={<Route className="w-6 h-6" />}
            number="4"
            title="A personal learning path"
            description="Learners get a paced course: short lessons, exercises, and reviews, personalized to their goal, schedule, and how they like to learn."
          />
        </div>
      </section>

      {/* The learning loop */}
      <section className="max-w-5xl mx-auto px-6 sm:px-8 py-16">
        <h2 className="text-2xl font-bold mb-3 text-center">Learning that actually sticks</h2>
        <p className="text-slate-400 text-center mb-12 max-w-2xl mx-auto">
          Not a document. Not a video. A daily loop of teach → practice → review,
          built from the expert's real material.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <LoopCard
            icon={<BookOpen className="w-5 h-5" />}
            title="Bite-sized lessons"
            description="One concept per card — comparisons, tables, and the expert's own memorable phrasing. Three minutes at a time."
          />
          <LoopCard
            icon={<ListChecks className="w-5 h-5" />}
            title="Multiple choice"
            description="Wrong answers aren't random — they're the misconceptions the expert has actually watched people fall for."
          />
          <LoopCard
            icon={<MousePointerClick className="w-5 h-5" />}
            title="Click & fill"
            description="The expert's real numbers and terms, with near-miss distractors. If they said −18°C, you learn −18°C."
          />
          <LoopCard
            icon={<MoveVertical className="w-5 h-5" />}
            title="Order the steps"
            description="Put real procedures back in sequence — and learn why the order matters, in the expert's words."
          />
          <LoopCard
            icon={<RefreshCw className="w-5 h-5" />}
            title="Smart checkpoints"
            description="Spaced repetition that targets what you got wrong and what's going stale — freshly rephrased so it never feels like a rerun."
          />
          <LoopCard
            icon={<Gauge className="w-5 h-5" />}
            title="Your pace, always"
            description="Change your goal, time budget, or focus areas any time. The path re-plans around you without losing your progress."
          />
        </div>
      </section>

      {/* Provenance */}
      <section className="max-w-5xl mx-auto px-6 sm:px-8 py-16">
        <div className="bg-slate-800/50 border border-slate-700/50 p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-orange-500/10 shrink-0 text-orange-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold mb-2">Every lesson traces back to the expert</h2>
              <p className="text-slate-400 leading-relaxed">
                Generic AI courses are generated from thin air. Forge is different by construction:
                every lesson, exercise, and answer cites the specific knowledge it was built
                from — captured in the interview, in the expert's words. If the knowledge base
                doesn't cover something, Forge says so instead of making it up.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-2 mt-8">
            {[
              { icon: <FileText className="w-4 h-4" />, name: 'Facts' },
              { icon: <Layers className="w-4 h-4" />, name: 'Procedures' },
              { icon: <GitBranch className="w-4 h-4" />, name: 'Decisions' },
              { icon: <AlertTriangle className="w-4 h-4" />, name: 'Warnings' },
              { icon: <Lightbulb className="w-4 h-4" />, name: 'Tips' },
              { icon: <Hash className="w-4 h-4" />, name: 'Metrics' },
              { icon: <BookOpen className="w-4 h-4" />, name: 'Definitions' },
              { icon: <Quote className="w-4 h-4" />, name: 'Examples' },
              { icon: <Info className="w-4 h-4" />, name: 'Context' },
            ].map((c) => (
              <div key={c.name} className="flex items-center gap-2 bg-slate-900/60 border border-slate-700/30 px-3 py-2">
                <span className="text-orange-400">{c.icon}</span>
                <span className="text-xs text-slate-400">{c.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Toolkit */}
      <section className="max-w-5xl mx-auto px-6 sm:px-8 py-16">
        <h2 className="text-2xl font-bold mb-3 text-center">And a toolkit for the moment of need</h2>
        <p className="text-slate-400 text-center mb-12 max-w-2xl mx-auto">
          Not everything is a course. When someone needs an answer right now, the same
          knowledge powers interactive tools.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { icon: <GitBranch className="w-4 h-4" />, name: 'Decision trees', desc: '"What should I do?" — branching logic with the expert\'s recommendations' },
            { icon: <ListChecks className="w-4 h-4" />, name: 'Checklists', desc: 'Requirements and readiness, grouped the way the expert thinks about them' },
            { icon: <Layers className="w-4 h-4" />, name: 'Step-by-step guides', desc: 'Procedures with the tips and warnings attached where they matter' },
            { icon: <Hash className="w-4 h-4" />, name: 'Calculators', desc: 'The expert\'s formulas and thresholds, interactive' },
            { icon: <MessageSquare className="w-4 h-4" />, name: 'Ask the expert', desc: 'Chat or voice, answering from the knowledge base — honestly bounded by it' },
            { icon: <Sparkles className="w-4 h-4" />, name: 'Personalized advice', desc: 'Describe your situation, get structured advice grounded in the expert\'s knowledge' },
          ].map((c) => (
            <div key={c.name} className="bg-slate-800/50 border border-slate-700/30 p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-orange-400">{c.icon}</span>
                <span className="text-sm font-medium">{c.name}</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-6 sm:px-8 py-20 text-center">
        <h2 className="text-3xl font-bold mb-4">Know something worth teaching?</h2>
        <p className="text-slate-400 max-w-xl mx-auto mb-8 leading-relaxed">
          Half an hour of conversation is all it takes. Forge does the rest.
        </p>
        <Link
          to="/workspaces"
          className="inline-flex items-center gap-2 px-8 py-4 bg-orange-600 hover:bg-orange-700 transition-colors font-medium text-lg"
        >
          Create your Forge
          <ArrowRight className="w-5 h-5" />
        </Link>
      </section>

      {/* Footer */}
      <section className="max-w-5xl mx-auto px-6 sm:px-8 py-10 border-t border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-400/60" />
            <span>Forge — expert knowledge, forged into learning</span>
          </div>
          <span>Built with Claude</span>
        </div>
      </section>
    </div>
  )
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="w-1.5 h-1.5 bg-orange-400 mt-1.5 shrink-0" />
      <span>{children}</span>
    </li>
  )
}

function Step({ icon, number, title, description }: {
  icon: React.ReactNode
  number: string
  title: string
  description: string
}) {
  return (
    <div className="text-center">
      <div className="w-12 h-12 mx-auto mb-4 bg-orange-500/10 flex items-center justify-center text-orange-400">
        {icon}
      </div>
      <div className="text-xs text-orange-400/60 font-medium mb-1">Step {number}</div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
    </div>
  )
}

function LoopCard({ icon, title, description }: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="bg-slate-800/40 border border-slate-700/40 p-5">
      <div className="flex items-center gap-2 mb-2 text-orange-400">
        {icon}
        <h3 className="font-medium text-white">{title}</h3>
      </div>
      <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
    </div>
  )
}
