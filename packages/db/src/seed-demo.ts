// Seed a demo forge with every component type
// Usage: bun run packages/db/src/seed-demo.ts
//        bun run packages/db/src/seed-demo.ts --clean (replace existing)

import { db } from "./index"
import { forges } from "./schema"
import { eq } from "drizzle-orm"
import type { ToolConfig } from "@forge/shared"

const DEMO_FORGE_ID = "11111111-1111-1111-1111-111111111111"

const toolConfig: ToolConfig = {
  title: "Complete Home Renovation Guide",
  description:
    "An interactive toolkit built from Sarah Chen's 15 years of residential renovation experience. Covers planning, budgeting, contractor selection, and project management.",
  theme: {
    primaryColor: "#1a1a2e",
    accentColor: "#2563eb",
    icon: "hammer",
  },
  layout: [
    // 1. decision_tree
    {
      id: "renovation_type_selector",
      type: "decision_tree",
      title: "Find Your Renovation Approach",
      description: "Answer a few questions to determine the best renovation strategy for your situation.",
      rootQuestion: "node_budget",
      nodes: [
        {
          id: "node_budget",
          question: "What's your total renovation budget?",
          options: [
            { label: "Under $25,000", nextNodeId: "node_scope_small" },
            { label: "$25,000 – $75,000", nextNodeId: "node_scope_medium" },
            { label: "Over $75,000", nextNodeId: "node_scope_large" },
          ],
        },
        {
          id: "node_scope_small",
          question: "What's the primary goal?",
          options: [
            {
              label: "Cosmetic refresh",
              recommendation: "DIY Cosmetic Refresh",
              explanation:
                "Focus on paint, fixtures, and finishes. Most work can be DIY with basic tools. Budget $5k–15k for materials, save the rest for unexpected finds behind walls.",
            },
            {
              label: "Fix structural issues",
              recommendation: "Targeted Structural Repair",
              explanation:
                "Hire a structural engineer first ($500–800). Get 3 contractor quotes. Prioritise foundation and water issues before anything cosmetic.",
            },
          ],
        },
        {
          id: "node_scope_medium",
          question: "Which rooms are you renovating?",
          options: [
            { label: "Kitchen only", nextNodeId: "node_kitchen" },
            { label: "Bathroom(s)", nextNodeId: "node_bathroom" },
            {
              label: "Multiple rooms",
              recommendation: "Phased Multi-Room Renovation",
              explanation:
                "Break into 2-3 phases. Start with the room that adds most value (usually kitchen). Keep 20% contingency. Hire a general contractor for coordination.",
            },
          ],
        },
        {
          id: "node_scope_large",
          question: "Are you planning to stay or sell?",
          options: [
            {
              label: "Staying long-term",
              recommendation: "Full Custom Renovation",
              explanation:
                "Design for your lifestyle, not resale. Invest in quality materials for high-use areas. Consider an architect for layout changes. Budget 25% for contingency.",
            },
            {
              label: "Selling within 5 years",
              recommendation: "ROI-Focused Renovation",
              explanation:
                "Focus on kitchen, bathrooms, and curb appeal — these return 70-80% of cost. Avoid over-customising. Neutral palettes. Get a real estate agent's input on local market.",
            },
          ],
        },
        {
          id: "node_kitchen",
          question: "Layout change or refresh?",
          options: [
            {
              label: "Keep existing layout",
              recommendation: "Kitchen Refresh Package",
              explanation:
                "Reface cabinets ($4k–8k), new countertops ($3k–6k), update appliances. Can be done in 2-3 weeks with minimal disruption.",
            },
            {
              label: "New layout needed",
              recommendation: "Full Kitchen Remodel",
              explanation:
                "Expect $40k–65k for a mid-range full remodel. Moving plumbing and electrical adds $5k–10k. Plan for 6-8 weeks. Set up a temporary kitchen elsewhere.",
            },
          ],
        },
        {
          id: "node_bathroom",
          question: "How many bathrooms?",
          options: [
            {
              label: "One bathroom",
              recommendation: "Single Bathroom Remodel",
              explanation:
                "Budget $15k–30k. Can be completed in 3-4 weeks. Waterproofing is the most critical step — don't cut corners here. Arrange alternative facilities during construction.",
            },
            {
              label: "Two or more",
              recommendation: "Multi-Bathroom Renovation",
              explanation:
                "Do them sequentially, not simultaneously. Always keep one functioning bathroom. Bundle tile and fixture orders for volume discounts. Budget $12k–25k each.",
            },
          ],
        },
      ],
    },

    // 2. checklist
    {
      id: "pre_renovation_checklist",
      type: "checklist",
      title: "Pre-Renovation Research Checklist",
      description: "Essential preparation steps before any renovation work begins.",
      groupByCategory: true,
      items: [
        { id: "cl_1", text: "Check local council planning permissions and building regulations", required: true, category: "Legal & Permits", helpText: "Contact your local council building department. Most cosmetic work doesn't need permits, but structural, electrical, and plumbing changes do." },
        { id: "cl_2", text: "Review HOA or body corporate restrictions", required: false, category: "Legal & Permits", helpText: "Some HOAs restrict exterior changes, noise hours, and contractor access." },
        { id: "cl_3", text: "Get at least 3 detailed contractor quotes", required: true, category: "Contractor Selection", helpText: "Quotes should itemise labour, materials, and timeline. Avoid lump-sum quotes with no breakdown." },
        { id: "cl_4", text: "Verify contractor licences and insurance", required: true, category: "Contractor Selection", helpText: "Ask for licence number, public liability insurance, and workers' compensation. Verify independently." },
        { id: "cl_5", text: "Check contractor references and past work", required: true, category: "Contractor Selection", helpText: "Call at least 2 references. Ask about timeline adherence, communication, and quality." },
        { id: "cl_6", text: "Set up a renovation budget spreadsheet", required: true, category: "Budget", helpText: "Track quotes, actual costs, and contingency. Include 15-20% buffer for unexpected costs." },
        { id: "cl_7", text: "Research material costs independently", required: false, category: "Budget", helpText: "Visit suppliers directly. Contractor markups on materials can be 15-30%." },
        { id: "cl_8", text: "Document existing conditions with photos", required: true, category: "Documentation", helpText: "Photograph every wall, floor, ceiling. Note any existing damage. This protects you in disputes." },
        { id: "cl_9", text: "Check for asbestos or lead paint (pre-1990 homes)", required: true, category: "Safety", helpText: "Professional testing costs $200-500. Removal is strictly regulated and can add $5k-20k." },
        { id: "cl_10", text: "Notify neighbours about upcoming work", required: false, category: "Logistics", helpText: "Courtesy notice about noise, parking, and timeline. Prevents complaints and maintains relationships." },
      ],
    },

    // 3. step_by_step
    {
      id: "contractor_hiring_steps",
      type: "step_by_step",
      title: "Hiring a Reliable Contractor",
      description: "A proven 7-step process for finding and vetting renovation contractors.",
      steps: [
        {
          id: "step_1",
          title: "Define your scope of work",
          content: "Write a detailed description of what you want done. Include materials preferences, timeline expectations, and any design references. The clearer your brief, the more accurate your quotes will be.",
          tips: ["Include photos of inspiration projects", "List must-haves vs nice-to-haves"],
          estimatedTime: "2-3 hours",
        },
        {
          id: "step_2",
          title: "Source candidates from multiple channels",
          content: "Get recommendations from friends, neighbours, and local hardware stores. Check trade directories and online reviews. Aim for 5-6 initial candidates to narrow down.",
          tips: ["Nextdoor and local Facebook groups are goldmines for honest reviews"],
          warnings: ["Avoid contractors who only advertise through letterbox drops"],
        },
        {
          id: "step_3",
          title: "Initial phone screening",
          content: "Call each candidate. Ask about their availability, relevant experience, and whether they're interested in your project size. This eliminates poor fits quickly.",
          estimatedTime: "30 min per call",
        },
        {
          id: "step_4",
          title: "Request detailed written quotes",
          content: "Invite your top 3 to visit the site. Provide the same scope document to each. Request itemised quotes within 2 weeks.",
          tips: ["If a contractor won't provide an itemised quote, that's a red flag"],
          warnings: ["Never accept verbal-only quotes"],
        },
        {
          id: "step_5",
          title: "Verify credentials",
          content: "Check licence numbers with your state licensing board. Verify insurance is current. Look up any complaints or legal actions.",
          estimatedTime: "1-2 hours per contractor",
        },
        {
          id: "step_6",
          title: "Check references and visit past projects",
          content: "Call 2-3 references per contractor. Ask specifically about: staying on budget, timeline accuracy, communication quality, and how they handled problems. If possible, visit a completed project in person.",
        },
        {
          id: "step_7",
          title: "Review and sign the contract",
          content: "The contract should include: detailed scope, total price with payment schedule, start and completion dates, change order process, warranty terms, and dispute resolution. Never pay more than 10% upfront.",
          warnings: ["Never pay the full amount before work is complete", "Get a lawyer to review contracts over $50k"],
        },
      ],
    },

    // 4. calculator
    {
      id: "renovation_budget_calculator",
      type: "calculator",
      title: "Renovation Budget Estimator",
      description: "Estimate your total renovation cost based on key project variables.",
      inputs: [
        {
          id: "room_count",
          label: "Number of rooms",
          type: "number",
          defaultValue: 2,
          min: 1,
          max: 10,
        },
        {
          id: "quality_level",
          label: "Finish quality",
          type: "select",
          options: [
            { label: "Budget (basic materials)", value: 150 },
            { label: "Mid-range (standard quality)", value: 300 },
            { label: "Premium (high-end finishes)", value: 550 },
          ],
          defaultValue: 300,
        },
        {
          id: "avg_sqm",
          label: "Average room size (sqm)",
          type: "number",
          defaultValue: 15,
          min: 5,
          max: 50,
          unit: "sqm",
        },
        {
          id: "structural_changes",
          label: "Structural changes needed",
          type: "toggle",
          defaultValue: 0,
        },
      ],
      formula: "(room_count * quality_level * avg_sqm) + (structural_changes * 15000) + (room_count * quality_level * avg_sqm * 0.15)",
      resultLabel: "Estimated Total (incl. 15% contingency)",
      resultUnit: "$",
      interpretation: [
        { range: [0, 20000], label: "Small Project", color: "#22c55e", advice: "Manageable as a DIY or single-trade project. You may not need a general contractor." },
        { range: [20000, 60000], label: "Medium Project", color: "#eab308", advice: "Hire a general contractor. Get 3+ quotes. Expect 4-8 weeks of work." },
        { range: [60000, 150000], label: "Large Project", color: "#f97316", advice: "Consider an architect or project manager. Phased approach recommended. Allow 3-6 months." },
        { range: [150000, 999999], label: "Major Renovation", color: "#ef4444", advice: "Full professional team recommended: architect, project manager, and specialised trades. Allow 6-12 months." },
      ],
    },

    // 5. info_card
    {
      id: "golden_rule_warning",
      type: "info_card",
      title: "The Golden Rule of Renovation Budgets",
      variant: "warning",
      content: "Every renovation will cost more than you expect. In 15 years of projects, I've never seen one come in under budget. Always keep 15-20% of your total budget as contingency — and don't touch it until you genuinely need it.",
      expandable: true,
      details: "Common budget-busters include: hidden water damage behind walls (found in ~40% of bathroom renovations), outdated wiring that doesn't meet current code ($3k-8k to upgrade), asbestos or lead paint remediation ($5k-20k), and scope creep from 'while we're at it' additions. The contingency fund is not optional — it's the difference between a completed project and a half-finished disaster.",
    },

    // 6. question_flow
    {
      id: "project_scoping_flow",
      type: "question_flow",
      title: "Personalised Project Scope Builder",
      description: "Answer these questions to get a tailored renovation plan based on your specific situation.",
      questions: [
        {
          id: "qf_1",
          text: "Describe your home (age, type, current condition)",
          inputType: "text",
          placeholder: "e.g., 1960s brick house, 3 bed, original kitchen and bathroom, good structural condition",
          required: true,
        },
        {
          id: "qf_2",
          text: "What's driving this renovation?",
          inputType: "select",
          options: ["Preparing to sell", "Just bought and want to update", "Growing family needs more space", "Fix deteriorating areas", "Lifestyle upgrade"],
          required: true,
        },
        {
          id: "qf_3",
          text: "What's your realistic budget range?",
          inputType: "select",
          options: ["Under $15,000", "$15,000 – $30,000", "$30,000 – $75,000", "$75,000 – $150,000", "Over $150,000"],
          required: true,
        },
        {
          id: "qf_4",
          text: "Which rooms need attention? (select all that apply)",
          inputType: "multiselect",
          options: ["Kitchen", "Bathroom(s)", "Living areas", "Bedrooms", "Outdoor/landscaping", "Structural/foundation"],
          required: true,
        },
        {
          id: "qf_5",
          text: "Timeline — when do you need this completed?",
          inputType: "select",
          options: ["Within 3 months", "3-6 months", "6-12 months", "No rush, want to do it right"],
          required: true,
        },
      ],
      completionPrompt: "Based on the home details, motivation, budget, rooms, and timeline provided, create a prioritised renovation plan with specific recommendations for sequencing the work, expected costs per phase, and key decisions to make first.",
    },

    // 7. custom (rich content)
    {
      id: "renovation_mistakes",
      type: "custom",
      title: "Top Renovation Mistakes I've Seen",
      description: "Hard-won lessons from 15 years and hundreds of renovation projects.",
      sections: [
        {
          heading: "The Most Expensive Mistakes",
          variant: "list",
          items: [
            "Choosing the cheapest contractor — you'll pay triple to fix their work",
            "Skipping the building inspection before buying a 'renovator's delight'",
            "Not getting council approval — illegal work destroys resale value",
            "Paying more than 10% upfront — if they go bust, your money's gone",
            "Changing your mind mid-project — every change order costs 2-3x the original price",
          ],
        },
        {
          heading: "Quick Stats",
          variant: "stats",
          stats: [
            { label: "Average kitchen renovation", value: "$35,000", description: "Mid-range, layout unchanged" },
            { label: "Average bathroom renovation", value: "$18,000", description: "Full gut and replace" },
            { label: "ROI on kitchen remodel", value: "72%", description: "National average at resale" },
            { label: "Projects that go over budget", value: "85%", description: "Average overrun: 22%" },
          ],
        },
        {
          heading: "Renovation Timeline Reality",
          variant: "timeline",
          items: [
            "Week 1-2: Planning, permits, material orders",
            "Week 3-4: Demolition and structural work",
            "Week 5-8: Rough-in (plumbing, electrical, framing)",
            "Week 9-12: Finishes (drywall, paint, flooring, fixtures)",
            "Week 13-14: Snagging list and final inspections",
            "Week 15+: The items you forgot about",
          ],
        },
        {
          heading: "Sarah's Rule of Thumb",
          variant: "quote",
          content: "Whatever timeline the contractor gives you, add 40%. Whatever budget they quote, add 20%. If you're still comfortable with those numbers, go ahead. If not, scale back the scope until you are.",
        },
      ],
    },

    // 8. quiz
    {
      id: "renovation_knowledge_quiz",
      type: "quiz",
      title: "Test Your Renovation Knowledge",
      description: "See how prepared you are before starting your renovation project.",
      mode: "knowledge_check",
      showImmediateFeedback: true,
      showScoreAtEnd: true,
      passingScore: 60,
      questions: [
        {
          id: "quiz_1",
          text: "What percentage of your renovation budget should you keep as contingency?",
          options: [
            { id: "q1_a", text: "5%", correct: false, explanation: "5% is far too low. Unexpected issues arise in almost every renovation." },
            { id: "q1_b", text: "10%", correct: false, explanation: "10% is still tight. One major surprise (like hidden water damage) can blow through this." },
            { id: "q1_c", text: "15-20%", correct: true, explanation: "Correct! 15-20% gives you enough buffer for the unexpected discoveries that happen in 85% of renovations." },
            { id: "q1_d", text: "30%+", correct: false, explanation: "While more buffer is safer, 30% means you're significantly under-scoping your project. 15-20% is the sweet spot." },
          ],
        },
        {
          id: "quiz_2",
          text: "What's the maximum you should pay a contractor upfront before work begins?",
          options: [
            { id: "q2_a", text: "10% of total contract", correct: true, explanation: "Correct! 10% (or enough to cover initial material orders) is standard. Larger deposits increase your risk if the contractor defaults." },
            { id: "q2_b", text: "25% of total contract", correct: false, explanation: "This is too much upfront risk. If the contractor goes bankrupt, you lose that deposit." },
            { id: "q2_c", text: "50% of total contract", correct: false, explanation: "Never pay half upfront. Legitimate contractors don't need this much to start." },
            { id: "q2_d", text: "Nothing until work starts", correct: false, explanation: "A small deposit (up to 10%) is reasonable and shows good faith. Zero deposit can sour the relationship from the start." },
          ],
        },
        {
          id: "quiz_3",
          text: "Which renovation typically has the best return on investment at resale?",
          options: [
            { id: "q3_a", text: "Master bedroom suite", correct: false, explanation: "Bedroom upgrades return only 40-55% of cost. They're personal and buyers may redo them anyway." },
            { id: "q3_b", text: "Kitchen remodel", correct: true, explanation: "Correct! Kitchen remodels return 70-80% and are consistently the highest-ROI renovation. Buyers prioritise kitchens above all else." },
            { id: "q3_c", text: "Home office addition", correct: false, explanation: "Home offices have variable ROI (40-60%) depending on the local market. Not all buyers need one." },
            { id: "q3_d", text: "Swimming pool", correct: false, explanation: "Pools actually decrease property value in many markets due to maintenance costs and safety concerns. ROI is often negative." },
          ],
        },
        {
          id: "quiz_4",
          text: "When should you check for asbestos in a renovation?",
          options: [
            { id: "q4_a", text: "Only if the house was built before 1950", correct: false, explanation: "Asbestos was used heavily until the late 1980s. Houses built up to 1990 can contain it." },
            { id: "q4_b", text: "Before any demolition in pre-1990 homes", correct: true, explanation: "Correct! Asbestos was used in construction until the late 1980s. Always test before disturbing any materials in older homes. Disturbing asbestos without proper procedures is illegal and dangerous." },
            { id: "q4_c", text: "Only if you see crumbling materials", correct: false, explanation: "Asbestos is often in perfect-looking materials like floor tiles, cement sheeting, and insulation. You can't identify it visually." },
            { id: "q4_d", text: "It's not a concern anymore", correct: false, explanation: "Asbestos remains in millions of homes. It's only safe when undisturbed. Any renovation that breaks into walls, floors, or roofing must check first." },
          ],
        },
        {
          id: "quiz_5",
          text: "What's the most important clause in a renovation contract?",
          options: [
            { id: "q5_a", text: "Start date", correct: false, explanation: "Start dates matter but they're often flexible. The real protection is in how changes are handled." },
            { id: "q5_b", text: "Change order process", correct: true, explanation: "Correct! The change order clause protects you from surprise costs. It should require written approval for any scope changes with pricing agreed before work proceeds." },
            { id: "q5_c", text: "Paint colours", correct: false, explanation: "Material specifications matter but can be amended. Process clauses are more critical." },
            { id: "q5_d", text: "Completion bonus", correct: false, explanation: "Completion bonuses can incentivise speed over quality. Better to have clear milestone payments tied to quality benchmarks." },
          ],
        },
      ],
    },
  ],
  contextLayers: [
    { level: 1, name: "Domain", type: "domain", content: "Home renovation, residential construction, contractor management, building regulations", priority: 1 },
    { level: 2, name: "Expert Knowledge", type: "expert", content: "Sarah Chen has 15 years of residential renovation experience across hundreds of projects, from small bathroom updates to full house renovations. She specialises in helping first-time renovators avoid costly mistakes.", priority: 2 },
    { level: 3, name: "Tool Context", type: "tool", content: "Interactive renovation planning toolkit with decision guides, budget calculators, checklists, and knowledge tests.", priority: 3 },
    { level: 4, name: "User Situation", type: "user", content: "The user is likely planning a renovation and looking for practical guidance on budgeting, hiring contractors, and managing the project.", priority: 4 },
    { level: 5, name: "Current Question", type: "question", content: "Address the user's specific question using renovation expertise and practical experience.", priority: 5 },
  ],
  operationsBoard: {
    id: "renovation_ops_board",
    type: "task_board",
    title: "Renovation Project Tasks",
    tasks: [
      { id: "task_1", text: "Review and update budget spreadsheet", frequency: "weekly", category: "Budget", linkedComponentId: "renovation_budget_calculator", linkedComponentTitle: "Renovation Budget Estimator" },
      { id: "task_2", text: "Walk through site and check progress against schedule", frequency: "weekly", category: "Project Management" },
      { id: "task_3", text: "Communicate with contractor on upcoming week's work", frequency: "weekly", category: "Communication" },
      { id: "task_4", text: "Document completed work with photos", frequency: "weekly", category: "Documentation", linkedComponentId: "pre_renovation_checklist", linkedComponentTitle: "Pre-Renovation Research Checklist" },
      { id: "task_5", text: "Review invoices against contract milestones before paying", frequency: "monthly", category: "Budget" },
      { id: "task_6", text: "Check material deliveries against orders", frequency: "as_needed", category: "Logistics" },
      { id: "task_7", text: "Review change orders and approve/reject", frequency: "as_needed", category: "Budget" },
      { id: "task_8", text: "Inspect completed work before signing off", frequency: "as_needed", category: "Quality" },
    ],
  },
}

async function main() {
  const args = process.argv.slice(2)
  const shouldClean = args.includes("--clean")

  if (shouldClean) {
    console.log("Cleaning existing demo forge...")
    await db.delete(forges).where(eq(forges.id, DEMO_FORGE_ID))
    console.log("Cleaned.\n")
  }

  console.log("Seeding demo forge with all component types...\n")

  const [forge] = await db
    .insert(forges)
    .values({
      id: DEMO_FORGE_ID,
      title: "Home Renovation Guide - Sarah Chen",
      expertName: "Sarah Chen",
      expertBio: "Residential renovation specialist with 15 years of experience across hundreds of projects. Helps first-time renovators avoid costly mistakes through practical, proven advice.",
      domain: "Home Renovation",
      targetAudience: "First-time home renovators planning their first major project",
      status: "complete",
      toolConfig,
      depth: "deep",
      updatedAt: new Date(),
      completedAt: new Date(),
    })
    .returning()

  console.log(`Created demo forge: ${forge.title} (${forge.id})`)
  console.log(`Status: ${forge.status}`)
  console.log(`\nComponents (${toolConfig.layout.length}):`)
  for (const comp of toolConfig.layout) {
    console.log(`  - ${comp.type}: ${comp.title}`)
  }
  console.log(`\nOperations board: ${toolConfig.operationsBoard?.title} (${toolConfig.operationsBoard?.tasks.length} tasks)`)
  console.log(`\nView at: http://localhost:3070/forge/${forge.id}/tool`)
  console.log(`Share at: http://localhost:3070/tool/${forge.id}`)

  process.exit(0)
}

main().catch((err) => {
  console.error("Seed failed:", err)
  process.exit(1)
})
