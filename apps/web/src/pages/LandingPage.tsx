import { Link } from 'react-router-dom'
import { Flame, Mic, Brain, Users, Zap, ArrowRight, Sparkles, MessageSquare, Layers, FileText, GitBranch, AlertTriangle, Lightbulb, Hash, BookOpen, Quote, Info } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-orange-950/20 via-transparent to-transparent" />
        <div className="max-w-4xl mx-auto px-8 pt-24 pb-16 relative">
          <div className="flex items-center gap-2 text-sm text-orange-400 mb-6">
            <Flame className="w-4 h-4" />
            <span>Built with Opus 4.6 : Claude Code Hackathon</span>
          </div>

          <h1 className="text-5xl font-bold leading-tight mb-6">
            Expert knowledge,<br />
            <span className="text-orange-400">forged into tools</span><br />
            for everyone.
          </h1>

          <p className="text-xl text-slate-400 max-w-2xl mb-10 leading-relaxed">
            Forge captures what experts know through natural conversation and transforms it
            into interactive tools anyone can use. No forms. No manuals. Just speak.
          </p>

          <div className="flex items-center gap-4">
            <Link
              to="/forges"
              className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 transition-colors font-medium text-lg"
            >
              Try It Out
              <ArrowRight className="w-5 h-5" />
            </Link>
            <a
              href="https://github.com/bigadamknight/forge"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 border border-slate-600 hover:border-slate-500 text-slate-300 hover:text-white transition-colors font-medium"
            >
              View Source
            </a>
          </div>
        </div>
      </section>

      {/* Problem Statement */}
      <section className="max-w-4xl mx-auto px-8 py-16">
        <div className="bg-slate-800/50 border border-slate-700/50 p-8">
          <div className="flex items-start gap-4 mb-4">
            <div className="p-2 bg-orange-500/10 shrink-0">
              <Zap className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <p className="text-sm text-orange-400 font-medium mb-1">Problem Statement: Break the Barriers</p>
              <p className="text-slate-300 leading-relaxed">
                Expert knowledge is one of the most powerful things in the world, and one of the hardest to share.
                An experienced food bank operator knows exactly how to feed 500 families a week. A master baker can
                diagnose sourdough problems by feel. A seasoned engineer knows which corners you can cut and which
                will collapse.
              </p>
              <p className="text-slate-400 mt-3 leading-relaxed">
                But that knowledge is locked in their heads. Forge breaks it out through conversation and makes it
                accessible to everyone through interactive tools, not static documents that nobody reads.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-4xl mx-auto px-8 py-16">
        <h2 className="text-2xl font-bold mb-12 text-center">How Forge Works</h2>
        <div className="grid grid-cols-3 gap-8">
          <Step
            icon={<Mic className="w-6 h-6" />}
            number="1"
            title="Speak Your Knowledge"
            description="An AI interviewer conducts a structured conversation, asking the right questions to draw out what you know. Voice or text, your choice."
          />
          <Step
            icon={<Brain className="w-6 h-6" />}
            number="2"
            title="Knowledge Extraction"
            description="As you talk, Opus extracts structured knowledge in real-time: facts, processes, decisions, pitfalls. Every insight captured and validated."
          />
          <Step
            icon={<Sparkles className="w-6 h-6" />}
            number="3"
            title="Interactive Tool"
            description="Your knowledge becomes a living tool: decision trees, checklists, calculators, quizzes. Share a link and anyone can benefit from your expertise."
          />
        </div>
      </section>

      {/* Opus Usage */}
      <section className="max-w-4xl mx-auto px-8 py-16">
        <h2 className="text-2xl font-bold mb-3 text-center">Powered by Claude Opus 4.6</h2>
        <p className="text-slate-400 text-center mb-12 max-w-2xl mx-auto">
          Opus isn't just the model, it's the architect. Seven distinct Opus roles orchestrate
          the entire pipeline from interview to interactive tool.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <OpusRole title="Interview Planner" description="Designs structured interview sections with extraction priorities based on domain analysis" />
          <OpusRole title="Conductor" description="Manages conversation flow in real-time, deciding when to probe deeper vs advance to new topics" />
          <OpusRole title="Knowledge Extractor" description="Pulls structured facts, processes, and decisions from natural conversation as it happens" />
          <OpusRole title="Tool Architect" description="Selects the right component types and designs the tool layout from extracted knowledge" />
          <OpusRole title="Expert Channel" description="Answers user questions by channelling the expert's knowledge through 5-layer cascading context" />
          <OpusRole title="Tool Refiner" description="Understands conversational edit requests and updates component configs in real-time" />
          <OpusRole title="Knowledge Integrator" description="Analyzes follow-up interviews and proposes updates to existing tools with new knowledge" />
        </div>
      </section>

      {/* Extraction Types */}
      <section className="max-w-4xl mx-auto px-8 py-16">
        <h2 className="text-2xl font-bold mb-3 text-center">9 Knowledge Types</h2>
        <p className="text-slate-400 text-center mb-12 max-w-2xl mx-auto">
          As the expert speaks, the Knowledge Extractor classifies every insight into one of nine types,
          each with a confidence score and tags. This structured taxonomy drives tool generation.
        </p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: <FileText className="w-4 h-4" />, name: 'Facts', desc: 'Concrete statements of truth with supporting evidence' },
            { icon: <Layers className="w-4 h-4" />, name: 'Procedures', desc: 'Step-by-step processes and workflows' },
            { icon: <GitBranch className="w-4 h-4" />, name: 'Decision Rules', desc: 'If/then logic and branching criteria' },
            { icon: <AlertTriangle className="w-4 h-4" />, name: 'Warnings', desc: 'Pitfalls, risks, and things to avoid' },
            { icon: <Lightbulb className="w-4 h-4" />, name: 'Tips', desc: 'Best practices, shortcuts, and expert advice' },
            { icon: <Hash className="w-4 h-4" />, name: 'Metrics', desc: 'Numbers, measurements, and thresholds' },
            { icon: <BookOpen className="w-4 h-4" />, name: 'Definitions', desc: 'Domain-specific terminology explained' },
            { icon: <Quote className="w-4 h-4" />, name: 'Examples', desc: 'Concrete illustrations and case studies' },
            { icon: <Info className="w-4 h-4" />, name: 'Context', desc: 'Background and situational knowledge' },
          ].map((c) => (
            <div key={c.name} className="bg-slate-800/50 border border-slate-700/30 p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-orange-400">{c.icon}</span>
                <span className="text-sm font-medium">{c.name}</span>
              </div>
              <p className="text-xs text-slate-500">{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Component Types */}
      <section className="max-w-4xl mx-auto px-8 py-16">
        <h2 className="text-2xl font-bold mb-3 text-center">Rich Interactive Components</h2>
        <p className="text-slate-400 text-center mb-12">
          Opus selects the right format for each piece of knowledge
        </p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: <Layers className="w-4 h-4" />, name: 'Decision Trees', desc: 'Branching logic with recommendations' },
            { icon: <Layers className="w-4 h-4" />, name: 'Checklists', desc: 'Requirements and readiness validation' },
            { icon: <Layers className="w-4 h-4" />, name: 'Step-by-Step', desc: 'Sequential procedures with tips' },
            { icon: <Layers className="w-4 h-4" />, name: 'Calculators', desc: 'Quantitative assessments with formulas' },
            { icon: <MessageSquare className="w-4 h-4" />, name: 'Question Flows', desc: 'Intake questionnaires with AI advice' },
            { icon: <Layers className="w-4 h-4" />, name: 'Quizzes', desc: 'Knowledge checks and scenarios' },
          ].map((c) => (
            <div key={c.name} className="bg-slate-800/50 border border-slate-700/30 p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-orange-400">{c.icon}</span>
                <span className="text-sm font-medium">{c.name}</span>
              </div>
              <p className="text-xs text-slate-500">{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-4xl mx-auto px-8 py-16">
        <h2 className="text-2xl font-bold mb-12 text-center">Key Features</h2>
        <div className="grid grid-cols-2 gap-6">
          <Feature
            title="Voice Interviews"
            description="ElevenLabs-powered conversational AI that conducts natural voice interviews with real-time knowledge extraction."
          />
          <Feature
            title="Live Knowledge Extraction"
            description="As the expert speaks, facts, processes, and decisions are extracted and validated in real-time using parallel Opus pipelines."
          />
          <Feature
            title="Follow-Up Interviews"
            description="Return to deepen knowledge in specific areas. New extractions integrate into existing tools through Opus-powered proposals."
          />
          <Feature
            title="Shareable Tools"
            description="One link gives anyone access to the expert's interactive tool. No accounts needed. Knowledge for everyone."
          />
          <Feature
            title="Expert Chat"
            description="Users can ask questions and get answers channelled through the expert's knowledge via 5-layer cascading context."
          />
          <Feature
            title="Inline Editing"
            description="Creators can refine generated tools through natural conversation or direct editing. The tool evolves with the expert."
          />
        </div>
      </section>

      {/* Built With */}
      <section className="max-w-4xl mx-auto px-8 py-16 border-t border-slate-800">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500 mb-1">Built with</p>
            <div className="flex items-center gap-4 text-sm text-slate-400">
              <span>Claude Opus 4.6</span>
              <span className="text-slate-700">|</span>
              <span>Claude Sonnet 4.5</span>
              <span className="text-slate-700">|</span>
              <span>React + TypeScript</span>
              <span className="text-slate-700">|</span>
              <span>Bun + Hono</span>
              <span className="text-slate-700">|</span>
              <span>ElevenLabs</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Users className="w-4 h-4" />
            <span>Adam Knight</span>
          </div>
        </div>
      </section>
    </div>
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

function OpusRole({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 bg-slate-800/30 border border-slate-700/30 p-4">
      <div className="w-2 h-2 bg-orange-400 mt-2 shrink-0" />
      <div>
        <p className="text-sm font-medium mb-0.5">{title}</p>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
    </div>
  )
}

function Feature({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-slate-800/30 border border-slate-700/30 p-5">
      <h3 className="font-medium mb-2">{title}</h3>
      <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
    </div>
  )
}
