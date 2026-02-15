// ============ Test Interview Fixtures ============
// 3 complete interviews for pipeline testing and e2e tests
//
// 1. Food Bank Operations - Maria Chen
// 2. Sourdough Bread Baking - James Thornton
// 3. Community Garden Setup - Priya Sharma

import type {
  InterviewConfig,
  ValidationResult,
  SectionSummary,
  ExtractionType,
} from "@forge/shared"

// ============ Types for fixture structure ============

export interface FixtureMessage {
  role: "user" | "assistant" | "system"
  content: string
}

export interface FixtureExtraction {
  type: ExtractionType
  content: string
  confidence: number
  tags: string[]
  structured?: Record<string, unknown>
}

export interface FixtureQuestion {
  text: string
  goal: string
  messages: FixtureMessage[]
  validation: ValidationResult
  extractions: FixtureExtraction[]
}

export interface FixtureSection {
  title: string
  goal: string
  summary: SectionSummary
  questions: FixtureQuestion[]
}

export interface FixtureInterview {
  forge: {
    title: string
    expertName: string
    expertBio: string
    domain: string
    targetAudience: string
  }
  interviewConfig: InterviewConfig
  sections: FixtureSection[]
}

// ============ Interview 1: Food Bank Operations ============

export const foodBankInterview: FixtureInterview = {
  forge: {
    title: "Food Bank Operations Guide",
    expertName: "Maria Chen",
    expertBio: "15 years managing urban food banks across three cities. Specialises in supply chain optimisation, volunteer coordination, and community partnerships. Currently runs a network of 4 food banks serving 2,000 families weekly.",
    domain: "Food Bank Management",
    targetAudience: "New food bank coordinators and community organisations starting their first food bank",
  },
  interviewConfig: {
    sections: [
      {
        title: "Daily Operations & Intake",
        goal: "Understand the day-to-day workflow of running a food bank",
        questions: [
          { text: "Walk me through a typical day at your food bank from the moment you arrive.", goal: "Capture the full daily operational workflow" },
          { text: "How do you handle the intake process when clients arrive?", goal: "Document the client intake procedure" },
          { text: "What systems do you use to track inventory and distribution?", goal: "Understand inventory management practices" },
        ],
      },
      {
        title: "Supply Chain & Sourcing",
        goal: "Learn how food is sourced, stored, and managed",
        questions: [
          { text: "Where does your food come from and how do you manage those relationships?", goal: "Map the supply chain and sourcing strategies" },
          { text: "How do you handle food safety and storage?", goal: "Document food safety protocols" },
        ],
      },
      {
        title: "Volunteer & Staff Management",
        goal: "Capture team coordination and volunteer management",
        questions: [
          { text: "How do you recruit and retain volunteers?", goal: "Understand volunteer management strategies" },
          { text: "What training do new volunteers need before they can start?", goal: "Document volunteer training requirements" },
        ],
      },
      {
        title: "Community Partnerships & Funding",
        goal: "Understand external relationships and sustainability",
        questions: [
          { text: "What partnerships have been most valuable and why?", goal: "Identify key partnership types and their value" },
          { text: "How do you approach fundraising and financial sustainability?", goal: "Capture funding strategies" },
        ],
      },
    ],
    estimatedDurationMinutes: 45,
    domainContext: "Food banks are community organisations that collect and distribute food to people in need. They operate through a mix of donations, government programmes, and partnerships with grocery stores and farms.",
    extractionPriorities: ["procedures", "decision_rules", "warnings", "metrics"],
  },
  sections: [
    {
      title: "Daily Operations & Intake",
      goal: "Understand the day-to-day workflow of running a food bank",
      summary: {
        summary: "Maria described a structured daily workflow starting at 6am with receiving deliveries, sorting donations, and preparing distribution areas. Client intake follows a respectful, efficient process using a simple digital system. Inventory is tracked through a combination of spreadsheets and a basic warehouse management tool.",
        key_points: [
          "Operations start at 6am with delivery receiving",
          "Sorting is the most labour-intensive daily task",
          "Client intake takes 15-20 minutes per household on first visit",
          "Inventory tracked through LinkUp software and backup spreadsheets",
        ],
        themes: ["efficiency", "dignity", "systematic processes"],
        notable_quotes: [
          "The first thing people see when they walk in sets the tone. We treat it like a shop, not a warehouse.",
          "If you lose track of your cold chain even once, you can make someone very ill.",
        ],
        metadata: {
          completion_quality: 0.92,
          main_topics: ["daily workflow", "intake process", "inventory management"],
        },
      },
      questions: [
        {
          text: "Walk me through a typical day at your food bank from the moment you arrive.",
          goal: "Capture the full daily operational workflow",
          messages: [
            { role: "assistant", content: "Maria, thank you so much for sharing your expertise with us today. I'd love to start right at the beginning of your day. Can you walk me through what a typical day looks like from the moment you arrive at the food bank?" },
            { role: "user", content: "Sure. I usually get in around 6am because that's when our first deliveries arrive. The morning crew, usually two or three volunteers and myself, we start by receiving whatever's come in overnight or early morning. Could be from the regional food bank warehouse, local grocery store donations, or sometimes farm surplus. First thing is always checking temperatures on anything refrigerated or frozen. We've had close calls before where a truck's cooling failed overnight and we had to reject the whole load. After receiving, we sort everything. That's the biggest job honestly. We categorise by type, check dates, and set aside anything that needs to go out same-day because it's close to expiry. By about 9am we're setting up the distribution area. We run it like a choice pantry now, so clients can actually walk through and pick what they want rather than getting a pre-packed box. It respects their dignity and reduces waste because people take what they'll actually eat. Distribution runs from 10 to 2, then we spend the afternoon on admin, restocking, and prepping for the next day." },
            { role: "assistant", content: "That's really detailed, thank you. The choice pantry model is interesting. You mentioned checking temperatures on deliveries as the very first step. Have you had situations where that process caught a real problem?" },
            { role: "user", content: "Oh absolutely. About twice a year we'll get a delivery where the refrigeration failed. Once it was 200kg of dairy and meat that had to go straight to waste. After that we implemented a strict rule: nothing gets unloaded until temp is verified. We use simple probe thermometers. Frozen must be minus 18 or below, chilled must be 5 or below. No exceptions. If it's borderline, we reject it. Better to lose one delivery than make a family ill." },
          ],
          validation: {
            meets_goal: true,
            confidence: 0.94,
            explanation: "Expert provided a comprehensive walkthrough of the full day from 6am delivery receiving through afternoon admin, covering all major operational phases.",
            missing_aspects: [],
            extracted_data: {
              key_points: [
                "Day starts at 6am with delivery receiving",
                "Temperature checks are the absolute first step",
                "Sorting is the most labour-intensive task",
                "Choice pantry model for client dignity",
                "Distribution runs 10am-2pm",
              ],
              relevant_quotes: [
                "Nothing gets unloaded until temp is verified",
                "We run it like a choice pantry now, so clients can actually walk through and pick what they want",
              ],
            },
          },
          extractions: [
            { type: "procedure", content: "Daily food bank workflow: 6am receive deliveries with temperature checks, sort and categorise donations, check dates, set aside same-day items, set up distribution area by 9am, run distribution 10am-2pm, afternoon admin and restocking.", confidence: 0.95, tags: ["daily-operations", "workflow"] },
            { type: "warning", content: "Always verify refrigeration temperatures before unloading deliveries. Frozen must be -18C or below, chilled must be 5C or below. Reject borderline loads - better to lose one delivery than risk food safety.", confidence: 0.97, tags: ["food-safety", "receiving"] },
            { type: "tip", content: "Run distribution as a choice pantry where clients select their own items rather than pre-packing boxes. Reduces waste and respects dignity.", confidence: 0.92, tags: ["distribution", "dignity"] },
            { type: "metric", content: "Distribution hours: 10am to 2pm daily. Morning prep takes approximately 3-4 hours before distribution begins.", confidence: 0.90, tags: ["scheduling", "operations"] },
            { type: "fact", content: "Refrigeration failures happen approximately twice per year. One incident resulted in 200kg of dairy and meat being wasted, leading to the implementation of mandatory temperature verification before unloading.", confidence: 0.88, tags: ["food-safety", "risk"] },
          ],
        },
        {
          text: "How do you handle the intake process when clients arrive?",
          goal: "Document the client intake procedure",
          messages: [
            { role: "assistant", content: "You mentioned setting up distribution at 9am and running like a choice pantry. Can you tell me more about what happens when a client walks through the door for the first time? What does the intake process look like?" },
            { role: "user", content: "First-time clients go through a registration process. We ask for basic info, name, address, household size, and any dietary restrictions or allergies. We don't ask about income or make them prove they need help. That was a deliberate decision we made years ago. If someone walks through our door, they need help, full stop. The whole first visit takes maybe 15-20 minutes because we also give them a quick tour, explain how the choice pantry works, and make sure they know about other services we can connect them to. Things like benefits advice, housing support, that sort of thing. For returning clients, they just check in with their name or a simple card we give them. Takes about 30 seconds. We track visits so we can report numbers to funders, but we never use it to limit access." },
            { role: "assistant", content: "I love that policy of not means-testing. How do you handle the dietary restrictions part? Is that just a note in the system or does it actually change what they receive?" },
            { role: "user", content: "It's active, not passive. When someone flags halal, kosher, vegetarian, nut allergy, whatever it is, we tag their profile. When they come through the pantry, volunteers can see the flags and guide them appropriately. For severe allergies we actually pre-check items and have a separate allergen-free section. It's not perfect but it's better than handing someone a bag and hoping for the best. We've also started printing simple labels on items that contain common allergens, similar to what you'd see in a supermarket." },
          ],
          validation: {
            meets_goal: true,
            confidence: 0.91,
            explanation: "Clear documentation of both first-time and returning client processes, including the no-means-testing policy and dietary accommodation system.",
            missing_aspects: ["data protection/GDPR considerations"],
            extracted_data: {
              key_points: [
                "No means testing - if someone comes, they need help",
                "First visit: 15-20 minutes with registration and tour",
                "Returning visits: 30-second check-in",
                "Dietary restrictions actively managed with profile tags",
              ],
              relevant_quotes: [
                "If someone walks through our door, they need help, full stop",
              ],
            },
          },
          extractions: [
            { type: "procedure", content: "Client intake: First-time visitors register with name, address, household size, and dietary restrictions (no income verification). Give a tour of the choice pantry and connect to other services. Takes 15-20 minutes. Returning clients check in with name or card in 30 seconds.", confidence: 0.95, tags: ["intake", "client-services"] },
            { type: "decision_rule", content: "Never means-test clients. If someone walks through the door, they need help. Do not ask about income or require proof of need.", confidence: 0.96, tags: ["policy", "dignity"] },
            { type: "procedure", content: "Dietary accommodation: Tag client profiles with dietary requirements (halal, kosher, vegetarian, allergies). Volunteers check flags during distribution. Maintain a separate allergen-free section for severe allergies. Label common allergens on items.", confidence: 0.93, tags: ["dietary", "food-safety", "inclusion"] },
            { type: "tip", content: "Connect clients to wraparound services during first visit (benefits advice, housing support, etc). The food bank is often the first point of contact for people in crisis.", confidence: 0.88, tags: ["referrals", "client-services"] },
          ],
        },
        {
          text: "What systems do you use to track inventory and distribution?",
          goal: "Understand inventory management practices",
          messages: [
            { role: "assistant", content: "You've described a really well-organised operation. What about the tech side? What systems do you use to keep track of all that inventory and distribution data?" },
            { role: "user", content: "We use LinkUp, which is a food bank specific inventory management tool. It's not fancy but it does the job. Every item that comes in gets logged, weight, category, date received, best-before date. When items go out during distribution, we log that too. The data feeds into our reporting for funders who want to know tonnage distributed, number of households served, that sort of thing. We also keep a parallel spreadsheet as backup because LinkUp has gone down on us twice in three years and you cannot run a food bank without knowing what you've got. One thing I'd stress to anyone starting out: don't over-engineer your tracking. A simple spreadsheet is fine for your first year. The important things to track are: what came in, where it came from, when it expires, and how much went out. Everything else is nice-to-have." },
          ],
          validation: {
            meets_goal: true,
            confidence: 0.85,
            explanation: "Good overview of inventory tracking tools and practices. Could go deeper on specific reporting metrics but covers the essentials.",
            missing_aspects: ["specific reporting formats for funders"],
            extracted_data: {
              key_points: [
                "Uses LinkUp food bank inventory software",
                "Tracks weight, category, date received, best-before",
                "Parallel spreadsheet as backup",
                "Key metrics: tonnage distributed, households served",
              ],
              relevant_quotes: [
                "Don't over-engineer your tracking. A simple spreadsheet is fine for your first year.",
              ],
            },
          },
          extractions: [
            { type: "tip", content: "Don't over-engineer inventory tracking when starting out. A simple spreadsheet covering what came in, source, expiry date, and what went out is sufficient for the first year.", confidence: 0.93, tags: ["inventory", "starting-out"] },
            { type: "fact", content: "Key data to track: item weight, category, date received, best-before date, distribution quantities. This feeds funder reports on tonnage distributed and households served.", confidence: 0.90, tags: ["inventory", "reporting"] },
            { type: "warning", content: "Always maintain a backup tracking system (spreadsheet) alongside any digital tool. Software outages can happen and you cannot run distribution without knowing current stock.", confidence: 0.91, tags: ["inventory", "resilience"] },
            { type: "definition", content: "LinkUp: A food bank-specific inventory management tool used to track incoming donations, stock levels, expiry dates, and distribution volumes.", confidence: 0.85, tags: ["tools", "inventory"] },
          ],
        },
      ],
    },
    {
      title: "Supply Chain & Sourcing",
      goal: "Learn how food is sourced, stored, and managed",
      summary: {
        summary: "Maria detailed a diversified supply chain with four main sources: regional food bank warehouse, direct supermarket partnerships, farm surplus programmes, and community food drives. Storage follows strict FIFO rotation with temperature-controlled zones.",
        key_points: [
          "Four main food sources with different management approaches",
          "Supermarket partnerships are the most reliable ongoing source",
          "FIFO rotation is non-negotiable",
          "Separate cold storage zones for different temperature requirements",
        ],
        themes: ["diversification", "food safety", "relationship management"],
        notable_quotes: [
          "Never depend on a single source. When COVID hit, our supermarket donations dropped 80% overnight.",
        ],
        metadata: {
          completion_quality: 0.88,
          main_topics: ["sourcing", "storage", "food safety"],
        },
      },
      questions: [
        {
          text: "Where does your food come from and how do you manage those relationships?",
          goal: "Map the supply chain and sourcing strategies",
          messages: [
            { role: "assistant", content: "Let's talk about where the food actually comes from. You mentioned grocery store donations and farm surplus earlier. Can you give me the full picture of your supply chain and how you manage those different sources?" },
            { role: "user", content: "We have four main channels. First is the regional food bank warehouse, FareShare in our case. They aggregate surplus from manufacturers and large retailers and we collect from them twice a week. That's maybe 40% of our volume. Second is direct supermarket partnerships. We have agreements with three local Tesco and two Sainsbury's stores. They give us their end-of-day surplus. That's our most reliable daily source, maybe 30% of volume. Third is farm surplus, which is seasonal but can be huge. During harvest season we might get hundreds of kilos of potatoes or carrots in one go. And fourth is community food drives, churches, schools, businesses doing collections. That's maybe 10% of volume but it's important for community engagement. The key lesson I've learned: never depend on a single source. When COVID hit, our supermarket donations dropped 80% overnight because everything was selling out. If we hadn't had the FareShare relationship and emergency government funding, we'd have been finished." },
          ],
          validation: {
            meets_goal: true,
            confidence: 0.93,
            explanation: "Comprehensive mapping of all four supply channels with volume percentages and practical management insights.",
            missing_aspects: [],
            extracted_data: {
              key_points: [
                "Four channels: regional warehouse (40%), supermarkets (30%), farms (seasonal), community drives (10%)",
                "Supermarket partnerships are most reliable daily source",
                "COVID showed the danger of single-source dependency",
              ],
              relevant_quotes: [
                "Never depend on a single source. When COVID hit, our supermarket donations dropped 80% overnight.",
              ],
            },
          },
          extractions: [
            { type: "fact", content: "Four main food sourcing channels: regional food bank warehouse (40% volume), direct supermarket partnerships (30%), farm surplus (seasonal), and community food drives (10%). Remaining ~20% from miscellaneous donations.", confidence: 0.94, tags: ["supply-chain", "sourcing"] },
            { type: "warning", content: "Never depend on a single food source. During COVID, supermarket donations dropped 80% overnight as everything was selling out. Diversified sourcing is essential for resilience.", confidence: 0.96, tags: ["supply-chain", "resilience", "risk"] },
            { type: "tip", content: "Build direct relationships with local supermarket store managers for end-of-day surplus collection. This becomes the most reliable daily source of fresh food.", confidence: 0.91, tags: ["supply-chain", "partnerships"] },
            { type: "example", content: "During harvest season, farm surplus can deliver hundreds of kilos of single items (potatoes, carrots) in one go, requiring rapid storage and distribution planning.", confidence: 0.87, tags: ["supply-chain", "seasonal"] },
          ],
        },
        {
          text: "How do you handle food safety and storage?",
          goal: "Document food safety protocols",
          messages: [
            { role: "assistant", content: "With that volume of food coming from different sources, food safety must be a significant consideration. How do you handle storage and food safety across all those different supply channels?" },
            { role: "user", content: "Food safety is the thing that keeps me up at night, honestly. We follow FIFO religiously, first in first out. Everything gets date-labelled when it arrives and shelved accordingly. We have three temperature zones: ambient for tins and dry goods, chilled at 1-5 degrees for dairy and fresh produce, and frozen at minus 18 or below. Temperature logs are checked twice daily, morning and afternoon, and we've got alarms on the walk-in fridges and freezers that alert us if temps go out of range. For food that comes in without clear date labelling, which happens a lot with farm surplus and some donations, we apply our own best-before dates based on conservative estimates. Leafy veg gets 3 days, root veg gets 7, that sort of thing. Every volunteer gets basic food hygiene training before they handle any food. It's a 2-hour session covering handwashing, cross-contamination, allergens, and temperature control. We also do a monthly deep clean of the entire facility and quarterly pest control inspections." },
          ],
          validation: {
            meets_goal: true,
            confidence: 0.92,
            explanation: "Thorough documentation of food safety protocols covering storage zones, temperature monitoring, date labelling, volunteer training, and facility maintenance.",
            missing_aspects: [],
            extracted_data: {
              key_points: [
                "Three temperature zones: ambient, chilled (1-5C), frozen (-18C)",
                "FIFO rotation is mandatory",
                "Twice-daily temperature log checks",
                "2-hour food hygiene training for all volunteers",
              ],
              relevant_quotes: [
                "Food safety is the thing that keeps me up at night, honestly",
              ],
            },
          },
          extractions: [
            { type: "procedure", content: "Food safety storage protocol: Three zones - ambient (tins/dry goods), chilled (1-5C for dairy/fresh), frozen (-18C). FIFO rotation mandatory. Temperature logs checked twice daily (morning and afternoon). Walk-in units have out-of-range alarms.", confidence: 0.96, tags: ["food-safety", "storage"] },
            { type: "procedure", content: "Date labelling for unlabelled items: Apply conservative best-before dates on arrival. Leafy vegetables get 3 days, root vegetables get 7 days. Everything date-labelled and shelved by date for FIFO.", confidence: 0.93, tags: ["food-safety", "labelling"] },
            { type: "procedure", content: "Volunteer food hygiene training: 2-hour mandatory session before handling any food. Covers handwashing, cross-contamination prevention, allergen awareness, and temperature control basics.", confidence: 0.94, tags: ["training", "food-safety"] },
            { type: "metric", content: "Facility maintenance: Monthly deep clean of entire facility. Quarterly pest control inspections.", confidence: 0.90, tags: ["maintenance", "food-safety"] },
          ],
        },
      ],
    },
    {
      title: "Volunteer & Staff Management",
      goal: "Capture team coordination and volunteer management",
      summary: {
        summary: "Maria relies on a core team of 5 regular volunteers supplemented by a rotating pool of 30-40. Recruitment comes primarily through word of mouth and local community groups. Retention depends on making volunteers feel valued and giving them ownership of specific roles.",
        key_points: [
          "Core team of 5 reliable volunteers plus rotating pool of 30-40",
          "Word of mouth is the best recruitment channel",
          "Retention comes from ownership and recognition",
          "New volunteers start with a buddy system",
        ],
        themes: ["community", "ownership", "recognition"],
        notable_quotes: [
          "The volunteers who stay longest are the ones who feel they own something.",
        ],
        metadata: {
          completion_quality: 0.87,
          main_topics: ["recruitment", "training", "retention"],
        },
      },
      questions: [
        {
          text: "How do you recruit and retain volunteers?",
          goal: "Understand volunteer management strategies",
          messages: [
            { role: "assistant", content: "Let's talk about the people side. You've mentioned your morning crew and volunteers a few times. How do you find and keep your volunteers?" },
            { role: "user", content: "Recruitment is actually the easy part. Word of mouth is our best channel by far. One happy volunteer tells their friends. We also post on local community Facebook groups and have a standing notice at the library and community centre. We get a lot of corporate volunteer days too, but those are one-offs, useful for big projects like reorganising the warehouse but not for daily operations. Retention is the harder problem. We've learned that the volunteers who stay longest are the ones who feel they own something. So we give people specific roles and titles. Someone's the Dairy Lead, someone else runs the Fresh Produce section. It sounds small but when someone has a defined role, they feel responsible and committed. We also do a volunteer appreciation evening every quarter, nothing fancy, just pizza and a genuine thank you. And we're flexible. If someone can only do Tuesday mornings, that's their Tuesday morning slot. We don't guilt people for not doing more." },
          ],
          validation: {
            meets_goal: true,
            confidence: 0.90,
            explanation: "Good coverage of both recruitment channels and retention strategies with practical examples.",
            missing_aspects: ["handling volunteer conflicts or performance issues"],
            extracted_data: {
              key_points: [
                "Word of mouth is the best recruitment channel",
                "Give volunteers ownership through specific roles and titles",
                "Quarterly appreciation evenings",
                "Flexibility with scheduling builds loyalty",
              ],
              relevant_quotes: [
                "The volunteers who stay longest are the ones who feel they own something",
              ],
            },
          },
          extractions: [
            { type: "tip", content: "Give volunteers specific roles and titles (e.g. 'Dairy Lead', 'Fresh Produce Lead'). Ownership of a defined area builds commitment and long-term retention.", confidence: 0.94, tags: ["volunteers", "retention"] },
            { type: "tip", content: "Be flexible with volunteer scheduling. Assign consistent time slots that work for each person. Never guilt someone for not doing more.", confidence: 0.90, tags: ["volunteers", "retention"] },
            { type: "fact", content: "Word of mouth is the most effective volunteer recruitment channel. Community Facebook groups, library notice boards, and community centres are also productive. Corporate volunteer days are useful for one-off projects but not daily operations.", confidence: 0.91, tags: ["volunteers", "recruitment"] },
            { type: "tip", content: "Hold quarterly volunteer appreciation events. Doesn't need to be elaborate, just pizza and genuine acknowledgement of contribution.", confidence: 0.88, tags: ["volunteers", "retention", "recognition"] },
          ],
        },
        {
          text: "What training do new volunteers need before they can start?",
          goal: "Document volunteer training requirements",
          messages: [
            { role: "assistant", content: "You mentioned the 2-hour food hygiene training earlier. Is there more to the onboarding process for new volunteers beyond that?" },
            { role: "user", content: "Yes, the food hygiene is just one piece. New volunteers do a half-day induction that covers four things. First, the food hygiene training I mentioned. Second, a tour of the facility so they know where everything is and the safety exits, fire extinguishers, first aid kit. Third, client interaction guidelines. This is really important. We teach them to be warm but not patronising, never to ask why someone needs help, and to respect privacy completely. We've had well-meaning volunteers say things like 'oh it must be so hard for you' and that's exactly what we don't want. Fourth, we pair them with a buddy for their first three shifts. The buddy is an experienced volunteer who shows them the ropes in their specific area. After those three buddy shifts, they're usually confident enough to work independently. We also do a quick check-in after their first month to see how they're finding it." },
          ],
          validation: {
            meets_goal: true,
            confidence: 0.93,
            explanation: "Comprehensive training programme documented with four clear components and a buddy system.",
            missing_aspects: [],
            extracted_data: {
              key_points: [
                "Half-day induction covering four areas",
                "Client interaction guidelines are critical",
                "Buddy system for first three shifts",
                "One-month check-in after starting",
              ],
              relevant_quotes: [
                "We teach them to be warm but not patronising, never to ask why someone needs help",
              ],
            },
          },
          extractions: [
            { type: "procedure", content: "Volunteer onboarding: Half-day induction covering (1) food hygiene training, (2) facility tour with safety points, (3) client interaction guidelines, (4) buddy pairing for first 3 shifts. Follow up with a check-in after first month.", confidence: 0.95, tags: ["training", "onboarding", "volunteers"] },
            { type: "warning", content: "Train volunteers on client interaction: be warm but never patronising, never ask why someone needs help, respect privacy completely. Well-meaning but inappropriate comments can make clients feel worse.", confidence: 0.94, tags: ["training", "dignity", "client-services"] },
            { type: "tip", content: "Pair new volunteers with an experienced buddy for their first 3 shifts. After buddy shifts most volunteers are confident to work independently.", confidence: 0.91, tags: ["training", "onboarding"] },
          ],
        },
      ],
    },
    {
      title: "Community Partnerships & Funding",
      goal: "Understand external relationships and sustainability",
      summary: {
        summary: "Key partnerships include supermarket chains, local council, schools, and faith organisations. Funding comes from a mix of grants, corporate sponsors, and individual donors. Maria emphasises that demonstrating impact through data is essential for securing and maintaining funding.",
        key_points: [
          "Supermarket partnerships provide both food and funding",
          "Local council relationship is critical for premises and referrals",
          "Data-driven impact reporting secures repeat funding",
          "Diversify funding sources like you diversify food sources",
        ],
        themes: ["sustainability", "impact measurement", "relationship building"],
        notable_quotes: [
          "Funders don't want to hear stories. They want to see numbers. Then they want to hear stories.",
        ],
        metadata: {
          completion_quality: 0.85,
          main_topics: ["partnerships", "fundraising", "reporting"],
        },
      },
      questions: [
        {
          text: "What partnerships have been most valuable and why?",
          goal: "Identify key partnership types and their value",
          messages: [
            { role: "assistant", content: "Let's talk about the broader ecosystem around your food bank. Which partnerships have been the most valuable to your operations?" },
            { role: "user", content: "Three stand out. First, our local council. They provide our premises at a peppercorn rent and refer clients to us through their social services team. That referral pipeline is incredibly valuable because it means we reach people who might not know we exist. Second, Tesco's community food connection programme. They don't just give us surplus food, they also provide funding for our infrastructure, things like our walk-in freezer and delivery van. Having a corporate partner who provides both food and capital investment is a game-changer. Third, the local faith network. We have five churches, a mosque, and a gurdwara that all run regular food drives for us. Beyond the food, they provide volunteer hours and community reach that we could never achieve on our own. The faith community reaches people who don't use social media or council services." },
          ],
          validation: {
            meets_goal: true,
            confidence: 0.91,
            explanation: "Three distinct partnership types identified with clear value propositions for each.",
            missing_aspects: ["how to approach and establish new partnerships"],
            extracted_data: {
              key_points: [
                "Local council: premises and client referrals",
                "Corporate: food surplus plus capital investment",
                "Faith network: food drives, volunteers, and community reach",
              ],
              relevant_quotes: [
                "The faith community reaches people who don't use social media or council services",
              ],
            },
          },
          extractions: [
            { type: "fact", content: "Three most valuable partnership types: (1) Local council for premises and client referrals, (2) Corporate retailers for food surplus plus capital investment, (3) Faith organisations for food drives, volunteers, and community reach to hard-to-reach populations.", confidence: 0.93, tags: ["partnerships", "strategy"] },
            { type: "tip", content: "Seek corporate partners who can provide both food surplus AND capital investment (e.g. infrastructure, equipment, vehicles). This dual support is transformative.", confidence: 0.90, tags: ["partnerships", "funding"] },
            { type: "tip", content: "Partner with faith organisations for community reach. They access populations who don't engage with social media or council services.", confidence: 0.89, tags: ["partnerships", "outreach"] },
          ],
        },
        {
          text: "How do you approach fundraising and financial sustainability?",
          goal: "Capture funding strategies",
          messages: [
            { role: "assistant", content: "And on the financial side, how do you keep the lights on? What's your approach to fundraising and making sure the operation is sustainable long-term?" },
            { role: "user", content: "Same principle as food sourcing: diversify. We have four main income streams. Grant funding from trusts and foundations, that's about 50% of our revenue. Corporate sponsorship, about 25%. Individual donations, maybe 15%. And fundraising events, the last 10%. For grants, the biggest thing I've learned is that funders want data. They want to see exactly how many families you served, how much food you distributed, what outcomes you achieved. We track everything and produce quarterly impact reports. I always say, funders don't want to hear stories first. They want to see numbers. Then they want to hear stories that bring those numbers to life. For sustainability, we've been building a reserve fund. We aim for three months of operating costs in reserve at all times. It took us four years to get there but it means we can survive a funding gap without cutting services. One mistake I see new food banks make is being too dependent on a single large grant. When that grant ends, they're in crisis. Start diversifying your funding from day one." },
          ],
          validation: {
            meets_goal: true,
            confidence: 0.90,
            explanation: "Clear breakdown of funding sources with percentages and practical advice on securing and maintaining funding.",
            missing_aspects: [],
            extracted_data: {
              key_points: [
                "Four income streams: grants (50%), corporate (25%), individual (15%), events (10%)",
                "Data-driven impact reporting is essential",
                "Three-month reserve fund target",
                "Diversify funding from day one",
              ],
              relevant_quotes: [
                "Funders don't want to hear stories. They want to see numbers. Then they want to hear stories.",
              ],
            },
          },
          extractions: [
            { type: "fact", content: "Typical food bank income streams: grants/trusts (50%), corporate sponsorship (25%), individual donations (15%), fundraising events (10%).", confidence: 0.89, tags: ["funding", "financial"] },
            { type: "tip", content: "Produce quarterly impact reports with hard data: families served, food distributed, outcomes achieved. Funders want numbers first, then human stories to bring those numbers to life.", confidence: 0.93, tags: ["funding", "reporting"] },
            { type: "decision_rule", content: "Build and maintain a reserve fund of at least 3 months operating costs. This protects against funding gaps and prevents service cuts during transitions.", confidence: 0.91, tags: ["financial", "sustainability"] },
            { type: "warning", content: "Never become dependent on a single large grant. When it ends, you'll be in crisis. Diversify funding sources from day one, just like food sourcing.", confidence: 0.94, tags: ["funding", "risk", "sustainability"] },
          ],
        },
      ],
    },
  ],
}

// ============ Interview 2: Sourdough Bread Baking ============

export const sourdoughInterview: FixtureInterview = {
  forge: {
    title: "Sourdough Bread Mastery",
    expertName: "James Thornton",
    expertBio: "Professional baker for 20 years, runs a micro-bakery from home producing 200 loaves per week. Trained in France, specialises in long-fermentation sourdough. Teaches weekend workshops and has helped over 500 home bakers start their sourdough journey.",
    domain: "Artisan Sourdough Baking",
    targetAudience: "Home bakers who want to start making sourdough bread from scratch",
  },
  interviewConfig: {
    sections: [
      {
        title: "Starter Creation & Maintenance",
        goal: "Understand how to create and maintain a sourdough starter",
        questions: [
          { text: "How do you create a sourdough starter from scratch?", goal: "Document the starter creation process" },
          { text: "What does a healthy starter look like and how do you troubleshoot problems?", goal: "Capture diagnostic skills for starter health" },
        ],
      },
      {
        title: "The Baking Process",
        goal: "Learn the full process from mixing to finished loaf",
        questions: [
          { text: "Walk me through your process for making a basic sourdough loaf.", goal: "Document the complete baking workflow" },
          { text: "How do you know when the dough is ready at each stage?", goal: "Capture the sensory assessment skills" },
        ],
      },
      {
        title: "Common Problems & Solutions",
        goal: "Document troubleshooting knowledge",
        questions: [
          { text: "What are the most common mistakes beginners make?", goal: "Identify failure patterns and prevention" },
          { text: "How do you adjust for different environments and seasons?", goal: "Capture environmental adaptation strategies" },
        ],
      },
      {
        title: "Equipment & Ingredients",
        goal: "Understand what's needed to get started",
        questions: [
          { text: "What equipment and ingredients does a beginner actually need?", goal: "Define the minimal setup for getting started" },
          { text: "How do different flours affect the final bread?", goal: "Document flour selection knowledge" },
        ],
      },
    ],
    estimatedDurationMinutes: 40,
    domainContext: "Sourdough bread relies on wild yeast fermentation rather than commercial yeast. The process is slower but produces bread with more complex flavour, better digestibility, and longer shelf life. It requires understanding fermentation, dough handling, and baking technique.",
    extractionPriorities: ["procedures", "decision_rules", "tips", "warnings"],
  },
  sections: [
    {
      title: "Starter Creation & Maintenance",
      goal: "Understand how to create and maintain a sourdough starter",
      summary: {
        summary: "James described a simple 7-day starter creation process using just flour and water. Key insight: consistency of feeding schedule matters more than any specific recipe. Troubleshooting comes down to smell, appearance, and rise timing.",
        key_points: [
          "Starter takes 7-14 days to establish",
          "Equal parts flour and water by weight",
          "Feed at the same time daily",
          "Temperature is the most important environmental factor",
        ],
        themes: ["patience", "consistency", "observation"],
        notable_quotes: [
          "Your starter is a pet. It needs regular feeding and a warm spot. Treat it well and it'll give you bread for decades.",
        ],
        metadata: {
          completion_quality: 0.91,
          main_topics: ["starter creation", "maintenance", "troubleshooting"],
        },
      },
      questions: [
        {
          text: "How do you create a sourdough starter from scratch?",
          goal: "Document the starter creation process",
          messages: [
            { role: "assistant", content: "James, thanks for joining us. Let's start at the very beginning. For someone who's never made sourdough before, how would you walk them through creating their first starter?" },
            { role: "user", content: "It's beautifully simple really. All you need is flour and water. Day one, mix 50 grams of wholemeal flour with 50 grams of water in a clean jar. Stir it well, cover loosely with a cloth or loose lid, never seal it airtight, and leave it at room temperature. By day two or three you might see some bubbles. That's good, things are waking up. Now you start feeding it. Every day at roughly the same time, discard half the mixture, then add 50 grams of flour and 50 grams of water. The discard is important because without it the acidity builds up too much and slows down the fermentation. By day five or six you should see it reliably rising and falling. The smell changes too, from a sort of funky almost unpleasant smell in the early days to a pleasant tangy yogurty aroma. By day seven to fourteen you should have a starter that roughly doubles in size within 4-8 hours of feeding. That's when it's ready to bake with. The single most important thing is temperature. Keep it somewhere between 22 and 26 degrees if you can. Too cold and it goes sluggish. Too hot and the bad bacteria can take over." },
          ],
          validation: {
            meets_goal: true,
            confidence: 0.95,
            explanation: "Complete step-by-step starter creation process with timeline, quantities, and key environmental requirements.",
            missing_aspects: [],
            extracted_data: {
              key_points: [
                "50g flour + 50g water to start",
                "Daily discard and feed at consistent time",
                "Ready in 7-14 days when it doubles in 4-8 hours",
                "Ideal temperature 22-26C",
              ],
              relevant_quotes: [
                "Never seal it airtight",
              ],
            },
          },
          extractions: [
            { type: "procedure", content: "Creating a sourdough starter: Day 1 - mix 50g wholemeal flour with 50g water in a clean jar, cover loosely. Days 2-14 - discard half daily, add 50g flour and 50g water at the same time each day. Ready when it doubles within 4-8 hours of feeding (usually day 7-14).", confidence: 0.96, tags: ["starter", "creation", "beginner"] },
            { type: "warning", content: "Never seal a sourdough starter jar airtight. It produces gas and needs to breathe. Use a loose lid or cloth cover.", confidence: 0.95, tags: ["starter", "safety"] },
            { type: "decision_rule", content: "A starter is ready to bake with when it reliably doubles in size within 4-8 hours of feeding and smells pleasantly tangy (like yogurt), not unpleasant or funky.", confidence: 0.94, tags: ["starter", "readiness"] },
            { type: "metric", content: "Ideal starter temperature: 22-26C. Below this range it goes sluggish, above it bad bacteria can dominate.", confidence: 0.93, tags: ["starter", "temperature"] },
            { type: "tip", content: "Daily discard is essential when building a starter. Without it, acidity builds up too much and slows fermentation.", confidence: 0.91, tags: ["starter", "maintenance"] },
          ],
        },
        {
          text: "What does a healthy starter look like and how do you troubleshoot problems?",
          goal: "Capture diagnostic skills for starter health",
          messages: [
            { role: "assistant", content: "Once someone has their starter going, how do they know if it's healthy? And what should they do when things go wrong?" },
            { role: "user", content: "A healthy starter has three tells. First, it should roughly double in size within 4-8 hours of feeding. Second, it should smell tangy and slightly sweet, like natural yogurt. Third, the texture should be bubbly and airy when you stir it, almost mousse-like. Now the problems. The most common one is a layer of grey liquid on top. That's hooch and it means your starter is hungry, you've left it too long between feeds. Just pour it off and feed normally. Not a disaster. Pink or orange streaks? That's bad. That's contamination and you need to start over. Don't try to save it. If it smells like nail polish remover, it's gone too acidic. Feed it twice a day for a few days instead of once and it should recover. The biggest one I see in my workshops: people panic on day three or four when it seems to go dead. There's always a lull around days 3-5 where activity drops. That's completely normal. The good bacteria are establishing themselves and outcompeting the bad ones. Just keep feeding and it'll come back." },
          ],
          validation: {
            meets_goal: true,
            confidence: 0.93,
            explanation: "Excellent diagnostic framework covering healthy signs, common problems, and their solutions including the critical 'day 3-5 lull' insight.",
            missing_aspects: [],
            extracted_data: {
              key_points: [
                "Three signs of health: doubles in 4-8h, yogurty smell, bubbly texture",
                "Grey liquid (hooch) = hungry, not dead",
                "Pink/orange = contamination, start over",
                "Nail polish smell = too acidic, feed more often",
                "Day 3-5 lull is normal",
              ],
              relevant_quotes: [
                "There's always a lull around days 3-5 where activity drops. That's completely normal.",
              ],
            },
          },
          extractions: [
            { type: "decision_rule", content: "Starter health check - three indicators: (1) doubles in 4-8 hours after feeding, (2) smells tangy like yogurt, (3) bubbly mousse-like texture when stirred. All three should be present.", confidence: 0.95, tags: ["starter", "diagnostics"] },
            { type: "decision_rule", content: "Grey liquid on top (hooch) = starter is hungry. Pour off and feed normally. Pink or orange streaks = contamination, must start over completely. Nail polish smell = too acidic, switch to twice-daily feeding.", confidence: 0.96, tags: ["starter", "troubleshooting"] },
            { type: "warning", content: "Days 3-5 of a new starter often show a lull in activity. This is completely normal as good bacteria establish dominance. Don't panic and don't stop feeding.", confidence: 0.94, tags: ["starter", "beginner", "patience"] },
            { type: "warning", content: "If a starter develops pink or orange streaks, discard it entirely and start over. This indicates harmful bacterial contamination that cannot be recovered.", confidence: 0.97, tags: ["starter", "food-safety", "contamination"] },
          ],
        },
      ],
    },
    {
      title: "The Baking Process",
      goal: "Learn the full process from mixing to finished loaf",
      summary: {
        summary: "James described a 24-hour baking timeline from autolyse to finished loaf. The process emphasises patience and dough feel over rigid timing. Key skills include recognising gluten development through the windowpane test and judging fermentation by dough volume and texture.",
        key_points: [
          "24-hour process from start to finish",
          "Autolyse before adding starter and salt",
          "Stretch and fold technique replaces kneading",
          "Cold retard overnight for flavour development",
          "Bake in a Dutch oven for steam",
        ],
        themes: ["patience", "sensory skills", "process understanding"],
        notable_quotes: [
          "Sourdough isn't about following a recipe to the minute. It's about learning to read your dough.",
        ],
        metadata: {
          completion_quality: 0.93,
          main_topics: ["baking process", "dough handling", "timing"],
        },
      },
      questions: [
        {
          text: "Walk me through your process for making a basic sourdough loaf.",
          goal: "Document the complete baking workflow",
          messages: [
            { role: "assistant", content: "Now for the main event. Can you walk us through your complete process for a basic sourdough loaf from start to finish?" },
            { role: "user", content: "Right, so my basic recipe is 500g strong white bread flour, 350g water, 100g active starter, and 10g salt. That's about 70% hydration which is good for beginners. Higher hydration makes a more open crumb but it's harder to handle. I start the evening before baking day. First, autolyse. That's just mixing the flour and water together and letting it sit for 30 minutes to an hour. This hydrates the flour and starts gluten development without any effort. After autolyse, I add the starter and salt and mix everything together until it's well combined. Then over the next 3-4 hours, I do a series of stretch and folds. That's where you grab one side of the dough, stretch it up and fold it over, then rotate and repeat. Four folds per set, every 30-45 minutes. You'll feel the dough change, it goes from a shaggy mess to smooth and elastic. Usually four sets is enough. Then I shape it into a round or oval, place it in a banneton dusted with rice flour, cover it, and put it straight in the fridge overnight. The cold retard does two things, it slows fermentation which develops more complex flavour, and it makes the dough easier to score and handle before baking. Next morning, I preheat the oven to 250 degrees with a Dutch oven inside for at least 45 minutes. Take the dough straight from fridge to Dutch oven, score the top with a razor blade, lid on, bake 20 minutes covered, then remove the lid and bake another 20-25 minutes until it's a deep golden brown. Rest for at least an hour before cutting. I know that's hard but cutting too early lets the steam out and the crumb goes gummy." },
          ],
          validation: {
            meets_goal: true,
            confidence: 0.96,
            explanation: "Comprehensive start-to-finish baking process with specific quantities, timings, and technique explanations.",
            missing_aspects: [],
            extracted_data: {
              key_points: [
                "500g flour, 350g water, 100g starter, 10g salt (70% hydration)",
                "Autolyse 30-60 minutes before adding starter",
                "4 sets of stretch-and-fold over 3-4 hours",
                "Overnight cold retard in fridge",
                "Bake at 250C in Dutch oven: 20min covered, 20-25min uncovered",
                "Rest 1 hour minimum before cutting",
              ],
              relevant_quotes: [
                "You'll feel the dough change. It goes from a shaggy mess to smooth and elastic.",
              ],
            },
          },
          extractions: [
            { type: "procedure", content: "Basic sourdough recipe: 500g strong white bread flour, 350g water (70% hydration), 100g active starter, 10g salt. Evening: autolyse flour+water 30-60min, add starter and salt, 4 sets of stretch-and-fold every 30-45min over 3-4 hours. Shape, place in rice-floured banneton, refrigerate overnight. Morning: preheat oven 250C with Dutch oven 45min, score dough, bake 20min covered + 20-25min uncovered. Rest 1 hour before cutting.", confidence: 0.97, tags: ["recipe", "procedure", "beginner"] },
            { type: "definition", content: "Autolyse: Mixing flour and water and letting them rest 30-60 minutes before adding starter and salt. Hydrates the flour and begins gluten development passively.", confidence: 0.95, tags: ["technique", "definition"] },
            { type: "definition", content: "Stretch and fold: Grab one side of dough, stretch upward and fold over, rotate 90 degrees and repeat. Four folds per set. Replaces kneading for sourdough and develops gluten structure.", confidence: 0.94, tags: ["technique", "definition"] },
            { type: "tip", content: "Cold retard (overnight fridge rest) develops complex flavour and makes dough easier to score and handle. Go straight from fridge to oven, no need to warm up.", confidence: 0.93, tags: ["technique", "flavour"] },
            { type: "warning", content: "Never cut sourdough bread within 1 hour of baking. Cutting too early releases steam and makes the crumb gummy. The bread is still cooking internally during this rest period.", confidence: 0.95, tags: ["baking", "common-mistake"] },
            { type: "metric", content: "70% hydration is ideal for beginners. Higher hydration creates more open crumb but is harder to handle.", confidence: 0.90, tags: ["recipe", "hydration"] },
          ],
        },
        {
          text: "How do you know when the dough is ready at each stage?",
          goal: "Capture the sensory assessment skills",
          messages: [
            { role: "assistant", content: "A lot of baking guides give times, but you mentioned feeling the dough change. How do you actually know when the dough is ready at each stage?" },
            { role: "user", content: "This is the hard bit to teach because it's all feel and observation. For the stretch and folds, you're looking for the dough to go from rough and sticky to smooth and springy. If you pull a small piece and stretch it thin, you should be able to see light through it without it tearing. That's the windowpane test and it means you've built enough gluten. For bulk fermentation, which is the whole stretch-and-fold phase, the dough should have increased in volume by about 50%, not doubled. That's the biggest mistake I see. People let it go too long because they've read 'let it double' from a commercial yeast recipe. With sourdough, 50% rise is usually perfect. The dough should also feel airy and jiggly, like a water balloon. For proofing after you've shaped it, do the poke test. Gently poke the dough with a floured finger. If it springs back slowly and leaves a slight indent, it's ready. Springs back fast means underproofed. Doesn't spring back at all means overproofed. And for baking, you're listening as much as looking. A finished loaf sounds hollow when you tap the bottom. The crust should be a deep amber, not pale gold. Most people underbake. Don't be afraid of colour." },
          ],
          validation: {
            meets_goal: true,
            confidence: 0.94,
            explanation: "Excellent sensory assessment guide covering each stage with specific tests and indicators.",
            missing_aspects: [],
            extracted_data: {
              key_points: [
                "Windowpane test for gluten development",
                "50% rise (not doubled) for bulk fermentation",
                "Poke test for proofing readiness",
                "Hollow tap and deep amber for doneness",
              ],
              relevant_quotes: [
                "The dough should feel airy and jiggly, like a water balloon",
                "Most people underbake. Don't be afraid of colour.",
              ],
            },
          },
          extractions: [
            { type: "procedure", content: "Windowpane test: Pull a small piece of dough and stretch thin. If you can see light through it without tearing, gluten is sufficiently developed. Do this after your stretch-and-fold sets.", confidence: 0.95, tags: ["technique", "gluten", "testing"] },
            { type: "decision_rule", content: "Bulk fermentation is done when dough has risen approximately 50%, NOT doubled. It should feel airy and jiggly like a water balloon. Doubling is for commercial yeast, not sourdough.", confidence: 0.96, tags: ["fermentation", "timing", "common-mistake"] },
            { type: "decision_rule", content: "Poke test for proofing: poke dough with floured finger. Springs back slowly with slight indent = ready. Springs back fast = underproofed, needs more time. Doesn't spring back = overproofed.", confidence: 0.95, tags: ["proofing", "testing"] },
            { type: "tip", content: "Most people underbake their sourdough. A finished loaf should be deep amber (not pale gold) and sound hollow when you tap the bottom. Don't be afraid of dark colour.", confidence: 0.93, tags: ["baking", "doneness", "common-mistake"] },
          ],
        },
      ],
    },
    {
      title: "Common Problems & Solutions",
      goal: "Document troubleshooting knowledge",
      summary: {
        summary: "James identified the top beginner mistakes as overproofing, using a starter that isn't active enough, and being afraid to handle wet dough. Environmental adjustments (mainly temperature) are the biggest variable between seasons and locations.",
        key_points: [
          "Overproofing is the #1 mistake",
          "Inactive starter leads to dense bread",
          "Wet dough fear leads to adding too much flour",
          "Temperature changes of just a few degrees significantly alter timing",
        ],
        themes: ["patience", "observation", "adaptation"],
        notable_quotes: [
          "Every failed loaf teaches you something. I still learn from mine.",
        ],
        metadata: {
          completion_quality: 0.89,
          main_topics: ["troubleshooting", "environmental adaptation", "beginner mistakes"],
        },
      },
      questions: [
        {
          text: "What are the most common mistakes beginners make?",
          goal: "Identify failure patterns and prevention",
          messages: [
            { role: "assistant", content: "After helping 500+ home bakers, you must see the same mistakes come up repeatedly. What are the top ones?" },
            { role: "user", content: "Number one is overproofing. People leave it too long and end up with a flat pancake that won't hold its shape. The dough goes from beautifully structured to slack and soupy. If that happens, it's very hard to rescue. Prevention is simple: watch the dough, not the clock. Number two is using a starter that isn't at peak activity. You should use your starter when it's at its highest rise point, 4-8 hours after feeding usually. Using it too early means it hasn't built enough strength, too late means it's past its peak. The float test can help, drop a spoonful in water. If it floats, it's ready. Number three is adding too much flour because they're scared of sticky dough. Sourdough IS sticky. You need to learn wet dough handling. Wet your hands instead of flouring them. Use a bench scraper. The stickiness is what gives you that beautiful open crumb. If you keep adding flour you'll get a dense brick. Number four is not preheating long enough. Your oven and Dutch oven need to be thoroughly, screaming hot. 45 minutes minimum at full temperature. The initial blast of heat is what gives you oven spring, that dramatic rise in the first few minutes." },
          ],
          validation: {
            meets_goal: true,
            confidence: 0.94,
            explanation: "Four clear mistakes identified with prevention strategies and explanations for each.",
            missing_aspects: [],
            extracted_data: {
              key_points: [
                "Overproofing is #1 mistake",
                "Use starter at peak activity",
                "Don't add extra flour for stickiness",
                "Preheat oven 45 minutes minimum",
              ],
              relevant_quotes: [
                "Watch the dough, not the clock",
              ],
            },
          },
          extractions: [
            { type: "warning", content: "Top beginner mistake: overproofing. Watch the dough, not the clock. If dough goes from structured to slack and soupy, it's overproofed and very hard to rescue.", confidence: 0.95, tags: ["beginner", "mistakes", "proofing"] },
            { type: "decision_rule", content: "Use starter at peak activity (highest rise, 4-8 hours after feeding). Float test: drop a spoonful in water - if it floats, it's ready. Too early = not strong enough, too late = past peak.", confidence: 0.94, tags: ["starter", "timing", "testing"] },
            { type: "tip", content: "Sourdough is inherently sticky. Wet your hands and use a bench scraper instead of adding flour. Extra flour produces dense bread. The stickiness creates the open crumb structure.", confidence: 0.93, tags: ["dough-handling", "beginner", "technique"] },
            { type: "warning", content: "Preheat oven with Dutch oven inside for minimum 45 minutes at full temperature (250C). Insufficient preheating kills oven spring - the initial heat blast creates the dramatic rise.", confidence: 0.92, tags: ["baking", "oven-spring", "preheating"] },
          ],
        },
        {
          text: "How do you adjust for different environments and seasons?",
          goal: "Capture environmental adaptation strategies",
          messages: [
            { role: "assistant", content: "How does the process change between summer and winter or in different kitchen environments?" },
            { role: "user", content: "Temperature is everything in sourdough. In summer when my kitchen is 28 degrees, the whole process speeds up dramatically. Bulk fermentation might only take 2-3 hours instead of 4. The starter gets more active. You have to watch things much more carefully. In winter when it drops to 18 degrees, everything slows right down. Bulk might take 6-8 hours. The trick is to use your oven with just the light on as a proofing box. The light generates enough warmth to bring it up to about 25-26 degrees which is perfect. Humidity matters too but less than temperature. In very dry environments the dough surface can crust over during bulk fermentation. Just cover it well with a damp tea towel. If you're at altitude, things ferment faster due to lower air pressure, so reduce your bulk time. And one thing people don't think about: your water matters. If you're on heavily chlorinated mains water, it can slow or even kill your starter. Use filtered water or leave tap water out overnight so the chlorine evaporates." },
          ],
          validation: {
            meets_goal: true,
            confidence: 0.91,
            explanation: "Good coverage of temperature, humidity, altitude, and water quality adaptations with practical solutions.",
            missing_aspects: [],
            extracted_data: {
              key_points: [
                "Summer 28C: bulk in 2-3 hours. Winter 18C: bulk in 6-8 hours",
                "Oven light as proofing box",
                "Cover dough in dry environments",
                "Chlorinated water can harm starter",
              ],
              relevant_quotes: [
                "Temperature is everything in sourdough",
              ],
            },
          },
          extractions: [
            { type: "decision_rule", content: "Adjust timing by temperature: At 28C (summer) bulk fermentation takes 2-3 hours. At 18C (winter) it takes 6-8 hours. Every few degrees makes a significant difference. Watch the dough, not the clock.", confidence: 0.94, tags: ["environment", "timing", "temperature"] },
            { type: "tip", content: "Use your oven with just the light on as a proofing box. The light generates ~25-26C which is ideal fermentation temperature. No need for expensive proofing equipment.", confidence: 0.93, tags: ["environment", "equipment", "hack"] },
            { type: "tip", content: "In dry environments, cover dough with a damp tea towel during bulk fermentation to prevent surface crusting.", confidence: 0.88, tags: ["environment", "humidity"] },
            { type: "warning", content: "Heavily chlorinated tap water can slow or kill a sourdough starter. Use filtered water, or leave tap water out overnight to let chlorine evaporate.", confidence: 0.92, tags: ["water", "starter", "environment"] },
            { type: "fact", content: "At high altitude, dough ferments faster due to lower air pressure. Reduce bulk fermentation time accordingly.", confidence: 0.87, tags: ["environment", "altitude"] },
          ],
        },
      ],
    },
    {
      title: "Equipment & Ingredients",
      goal: "Understand what's needed to get started",
      summary: {
        summary: "James advocates for a minimal setup to start. Essential items are a Dutch oven, digital scale, and good flour. Everything else is nice to have. Flour choice has the biggest impact on results, with strong bread flour being the starting point.",
        key_points: [
          "Dutch oven is the single most important piece of equipment",
          "Digital scale is essential - never measure by volume",
          "Strong bread flour (12%+ protein) for beginners",
          "Banneton, bench scraper, and lame are useful but not essential on day one",
        ],
        themes: ["minimalism", "accessibility", "ingredient quality"],
        notable_quotes: [
          "You can make world-class bread with a bowl, a Dutch oven, and a bag of flour.",
        ],
        metadata: {
          completion_quality: 0.86,
          main_topics: ["equipment", "flour", "getting started"],
        },
      },
      questions: [
        {
          text: "What equipment and ingredients does a beginner actually need?",
          goal: "Define the minimal setup for getting started",
          messages: [
            { role: "assistant", content: "Let's talk about the practical setup. What does someone actually need to buy before they start their first loaf?" },
            { role: "user", content: "The beauty of sourdough is you need almost nothing. The absolute essentials are: a large mixing bowl, a Dutch oven with a lid, a digital scale, a razor blade or sharp knife for scoring, and that's it. The Dutch oven is the single most important thing. It creates the steam environment that gives you a crispy crust and good oven spring. You can use any oven-safe pot with a lid. Cast iron is ideal but ceramic works. I've seen people use a stainless steel stockpot turned upside down over a baking tray and get great results. Digital scale because you must weigh everything in grams. Cup measurements are wildly inconsistent and sourdough is sensitive to ratios. A bench scraper is about a fiver and makes handling wet dough so much easier. A banneton proofing basket is nice for shaping but for your first loaves just use a bowl lined with a well-floured tea towel. For ingredients: strong white bread flour with at least 12% protein, water, and salt. That's literally it. You already made the starter. The whole setup costs maybe 30 to 40 pounds if you already own a mixing bowl." },
          ],
          validation: {
            meets_goal: true,
            confidence: 0.92,
            explanation: "Clear minimal equipment list with budget-friendly alternatives and cost estimate.",
            missing_aspects: [],
            extracted_data: {
              key_points: [
                "Essentials: bowl, Dutch oven, digital scale, scoring blade",
                "Dutch oven is the most important piece",
                "Whole setup costs 30-40 GBP",
                "Cup measurements are too inconsistent for sourdough",
              ],
              relevant_quotes: [
                "You can use any oven-safe pot with a lid",
              ],
            },
          },
          extractions: [
            { type: "fact", content: "Essential sourdough equipment: large mixing bowl, Dutch oven with lid, digital scale, razor blade for scoring. Total cost approximately 30-40 GBP if you already have a bowl.", confidence: 0.93, tags: ["equipment", "beginner", "budget"] },
            { type: "tip", content: "Any oven-safe pot with a lid works as a Dutch oven alternative. Cast iron is ideal, ceramic works, even a stainless steel stockpot inverted over a baking tray produces good results.", confidence: 0.91, tags: ["equipment", "alternatives"] },
            { type: "warning", content: "Always weigh ingredients in grams with a digital scale. Cup/volume measurements are too inconsistent for sourdough, which is sensitive to hydration ratios.", confidence: 0.94, tags: ["equipment", "technique", "beginner"] },
            { type: "tip", content: "For your first loaves, use a bowl lined with a well-floured tea towel instead of buying a banneton proofing basket. A bench scraper (approx 5 GBP) makes wet dough handling much easier.", confidence: 0.90, tags: ["equipment", "budget", "beginner"] },
          ],
        },
        {
          text: "How do different flours affect the final bread?",
          goal: "Document flour selection knowledge",
          messages: [
            { role: "assistant", content: "You mentioned strong white with 12% protein. How do different flours change the outcome?" },
            { role: "user", content: "Flour is where the magic and the science meet. Protein content is king. Strong bread flour has 12-14% protein which creates a strong gluten network, that's what traps the gas and gives you rise and structure. Plain flour at 10% protein will work but you'll get a denser, flatter loaf. Wholemeal flour adds flavour and nutrition but absorbs more water, so you need to increase hydration by about 5-10%. It also ferments faster because there's more food for the wild yeast. A nice starter blend is 80% white and 20% wholemeal. Gives you good structure with some earthy flavour. Rye flour is interesting. It has very little gluten so you can't make a 100% rye sourdough that behaves like wheat. But 10-20% rye in a mostly wheat dough adds incredible depth of flavour and a slightly denser, moister crumb. Spelt is an ancient grain that's beautiful in sourdough but the gluten is weaker and more fragile, so handle it very gently. Less stretching, shorter bulk fermentation. The one rule: if you're changing flour, change only one variable at a time. Don't switch from white to wholemeal AND change your hydration AND try a new shaping technique. You'll never know what caused the result." },
          ],
          validation: {
            meets_goal: true,
            confidence: 0.92,
            explanation: "Comprehensive flour comparison covering protein content, hydration adjustments, and blending strategies.",
            missing_aspects: [],
            extracted_data: {
              key_points: [
                "12-14% protein in bread flour for best structure",
                "Wholemeal needs 5-10% more water",
                "80/20 white/wholemeal is a good starter blend",
                "Rye at 10-20% adds depth without structural issues",
                "Change one variable at a time",
              ],
              relevant_quotes: [
                "Flour is where the magic and the science meet",
              ],
            },
          },
          extractions: [
            { type: "fact", content: "Flour protein content determines bread structure: Strong bread flour 12-14% (best rise and structure), plain flour 10% (denser, flatter). Protein creates gluten which traps gas.", confidence: 0.94, tags: ["flour", "ingredients", "science"] },
            { type: "decision_rule", content: "When using wholemeal flour, increase hydration by 5-10% as it absorbs more water. A good starting blend is 80% white / 20% wholemeal for structure plus earthy flavour.", confidence: 0.93, tags: ["flour", "recipe", "hydration"] },
            { type: "tip", content: "Add 10-20% rye flour to wheat dough for incredible depth of flavour and a slightly denser, moister crumb, without structural issues of pure rye.", confidence: 0.91, tags: ["flour", "flavour", "recipe"] },
            { type: "warning", content: "When experimenting with different flours, change only one variable at a time. Changing flour, hydration, and technique simultaneously makes it impossible to learn what caused the result.", confidence: 0.93, tags: ["flour", "learning", "method"] },
            { type: "fact", content: "Spelt sourdough: beautiful flavour but weaker, more fragile gluten. Handle gently with less stretching and shorter bulk fermentation.", confidence: 0.89, tags: ["flour", "spelt", "technique"] },
          ],
        },
      ],
    },
  ],
}

// ============ Interview 3: Community Garden Setup ============

export const communityGardenInterview: FixtureInterview = {
  forge: {
    title: "Starting a Community Garden",
    expertName: "Priya Sharma",
    expertBio: "Urban horticulturist who has helped establish 12 community gardens across London over the past 8 years. Background in landscape architecture. Focuses on making gardens accessible to complete beginners and diverse communities. Currently manages a network of 3 gardens serving 200+ plot holders.",
    domain: "Community Garden Management",
    targetAudience: "Neighbourhood groups and local organisations wanting to start their first community garden",
  },
  interviewConfig: {
    sections: [
      {
        title: "Getting Started & Finding Land",
        goal: "Understand how to go from idea to secured land",
        questions: [
          { text: "What's the very first step when a group wants to start a community garden?", goal: "Document the initial planning process" },
          { text: "How do you find and secure land for a community garden?", goal: "Map land acquisition strategies" },
        ],
      },
      {
        title: "Garden Design & Infrastructure",
        goal: "Learn how to design and build the physical garden",
        questions: [
          { text: "How do you design a community garden layout that works for everyone?", goal: "Capture design principles and accessibility considerations" },
          { text: "What infrastructure does a community garden need on day one?", goal: "Define minimum viable infrastructure" },
        ],
      },
      {
        title: "Community Organisation & Governance",
        goal: "Understand the social and organisational side",
        questions: [
          { text: "How do you structure the organisation and decision-making?", goal: "Document governance models" },
          { text: "How do you handle conflicts between plot holders?", goal: "Capture conflict resolution approaches" },
        ],
      },
      {
        title: "Growing & Seasonal Planning",
        goal: "Practical growing advice for the group",
        questions: [
          { text: "What should a new community garden grow in its first year?", goal: "Identify beginner-friendly crops and planning" },
          { text: "How do you keep the garden going through winter and maintain momentum?", goal: "Capture year-round engagement strategies" },
        ],
      },
    ],
    estimatedDurationMinutes: 40,
    domainContext: "Community gardens are shared spaces where people grow food, flowers, and community connections. They require navigating land access, group dynamics, horticultural knowledge, and long-term sustainability. They serve multiple purposes: food production, mental health, community building, and environmental education.",
    extractionPriorities: ["procedures", "decision_rules", "tips", "examples"],
  },
  sections: [
    {
      title: "Getting Started & Finding Land",
      goal: "Understand how to go from idea to secured land",
      summary: {
        summary: "Priya emphasised that community comes before garden. The first step is building a core group and gauging genuine demand. Land acquisition works through council allotment lists, meanwhile leases on vacant land, and partnerships with housing associations and schools.",
        key_points: [
          "Build core group of 5-8 committed people first",
          "Gauge demand through community meetings before seeking land",
          "Council, housing associations, and schools are the main land sources",
          "Meanwhile leases on vacant land can work but need clear terms",
        ],
        themes: ["community first", "patience", "relationships"],
        notable_quotes: [
          "Start with the community, not the land. I've seen beautiful plots fail because nobody actually wanted to garden there.",
        ],
        metadata: {
          completion_quality: 0.90,
          main_topics: ["initial planning", "land acquisition", "community building"],
        },
      },
      questions: [
        {
          text: "What's the very first step when a group wants to start a community garden?",
          goal: "Document the initial planning process",
          messages: [
            { role: "assistant", content: "Priya, thank you for sharing your experience with us. Let's start at the very beginning. A group of neighbours are keen to start a community garden. What should they do first?" },
            { role: "user", content: "The absolute first thing, and people always want to skip this, is to check if there's genuine demand. Don't start with land, start with people. Get 5-8 committed people together as a core group. These are people who'll actually show up to meetings, help plan, and do the unglamorous work. Then hold a community meeting, publicise it through letterbox drops, community Facebook groups, the local library. You want to know: how many people would actually use this garden? What would they want to grow? Do they have any experience? What time can they commit? I've seen beautiful plots fail because 3 enthusiastic people secured land and then realised nobody else was interested. The demand has to be real and broad. Once you've established demand, the core group should become a constituted group with a simple constitution. This matters because funders, councils, and landlords won't deal with informal groups. You need a bank account, named officers, and agreed rules. It sounds bureaucratic but it's the foundation that everything else builds on." },
          ],
          validation: {
            meets_goal: true,
            confidence: 0.93,
            explanation: "Clear initial planning process from gauging demand through to constituting the group formally.",
            missing_aspects: [],
            extracted_data: {
              key_points: [
                "Check genuine demand first, not land",
                "Core group of 5-8 committed people",
                "Hold community meeting to gauge interest",
                "Constitute formally with bank account and officers",
              ],
              relevant_quotes: [
                "Start with the community, not the land",
              ],
            },
          },
          extractions: [
            { type: "procedure", content: "Starting a community garden: (1) Assemble core group of 5-8 committed people, (2) Hold community meeting to gauge demand (letterbox drops, Facebook groups, library notices), (3) Assess interest levels, growing preferences, experience, and time commitments, (4) Constitute formally with a simple constitution, bank account, named officers, and agreed rules.", confidence: 0.95, tags: ["getting-started", "planning"] },
            { type: "warning", content: "Don't start with land, start with people. Beautiful plots fail because 3 enthusiastic people secured land then realised nobody else was interested. Demand must be real and broad before seeking a site.", confidence: 0.96, tags: ["getting-started", "common-mistake"] },
            { type: "tip", content: "Become a constituted group early (simple constitution, bank account, named officers). Funders, councils, and landlords won't deal with informal groups. It's bureaucratic but foundational.", confidence: 0.93, tags: ["governance", "funding", "credibility"] },
          ],
        },
        {
          text: "How do you find and secure land for a community garden?",
          goal: "Map land acquisition strategies",
          messages: [
            { role: "assistant", content: "Once you've got your group and confirmed demand, how do you actually find somewhere to garden?" },
            { role: "user", content: "Three main routes. First, your local council. Every council has an allotment officer or a parks department. They may have land earmarked for community use or know of disused allotment sites. This is the most straightforward but can be slow, sometimes a year or more of waiting lists. Second, meanwhile leases. This is where you approach landowners, often developers, who have vacant land awaiting planning permission. They'll sometimes lease it to a community garden for a nominal rent in exchange for the land being maintained and looking good rather than becoming a dumping ground. The catch is these are usually time-limited, maybe 2-5 years, and you might have to move. Get everything in writing. We lost a garden after 18 months because the developer started building early and we had nothing formal. Third, partnerships. Housing associations often have unused green spaces within their estates. Schools sometimes have land they can't maintain. Churches may have grounds. The key here is approaching them with a clear proposal showing what you'll do, how you'll maintain it, and what insurance you'll carry. I always bring a one-page proposal with a rough site plan when approaching landowners. It shows you're serious and organised, not just dreamers. And always bring up insurance early because that's the first thing any landowner will ask about." },
          ],
          validation: {
            meets_goal: true,
            confidence: 0.92,
            explanation: "Three distinct land acquisition strategies documented with practical advice and a cautionary tale.",
            missing_aspects: ["insurance specifics"],
            extracted_data: {
              key_points: [
                "Three routes: council, meanwhile leases, partnerships",
                "Council route is straightforward but slow",
                "Meanwhile leases need formal written agreements",
                "Always bring a one-page proposal to landowners",
              ],
              relevant_quotes: [
                "We lost a garden after 18 months because the developer started building early and we had nothing formal",
              ],
            },
          },
          extractions: [
            { type: "fact", content: "Three main routes to community garden land: (1) Local council allotment/parks department - straightforward but slow (1+ year wait), (2) Meanwhile leases on vacant developer land - time-limited (2-5 years) at nominal rent, (3) Partnerships with housing associations, schools, or churches who have unused green space.", confidence: 0.94, tags: ["land", "acquisition", "strategy"] },
            { type: "warning", content: "Always get meanwhile lease agreements in writing with clear terms. One garden was lost after 18 months when a developer started building early with nothing formal in place.", confidence: 0.96, tags: ["land", "legal", "risk"] },
            { type: "tip", content: "When approaching any landowner, bring a one-page proposal with a rough site plan. Shows you're serious and organised. Always raise insurance early as it's the first thing landowners ask about.", confidence: 0.93, tags: ["land", "approach", "credibility"] },
            { type: "example", content: "Meanwhile lease arrangement: developer has vacant land awaiting planning permission. Community garden leases at nominal rent, keeping land maintained and presentable rather than becoming a dumping ground. Win-win but time-limited.", confidence: 0.90, tags: ["land", "meanwhile-lease", "example"] },
          ],
        },
      ],
    },
    {
      title: "Garden Design & Infrastructure",
      goal: "Learn how to design and build the physical garden",
      summary: {
        summary: "Design should prioritise accessibility and community space alongside growing plots. Raised beds are essential for accessibility. A communal area with seating is as important as the growing space. Day-one infrastructure needs are modest: water access, a secure tool store, and paths.",
        key_points: [
          "Raised beds for accessibility are non-negotiable",
          "Include communal gathering space",
          "Minimum infrastructure: water supply, tool storage, paths",
          "Design for the least experienced member",
        ],
        themes: ["accessibility", "community", "pragmatism"],
        notable_quotes: [
          "The tea-drinking area is as important as the growing beds. That's where the community actually happens.",
        ],
        metadata: {
          completion_quality: 0.88,
          main_topics: ["garden design", "accessibility", "infrastructure"],
        },
      },
      questions: [
        {
          text: "How do you design a community garden layout that works for everyone?",
          goal: "Capture design principles and accessibility considerations",
          messages: [
            { role: "assistant", content: "Now you've got land. How do you go about designing the actual garden layout?" },
            { role: "user", content: "The first rule is design for your least experienced, least able-bodied member. Because if the garden works for them, it works for everyone. That means raised beds are non-negotiable if budget allows. Standard height is about 60cm which means people don't have to bend down. For wheelchair users you want at least a few beds at 75-80cm with clearance underneath. We usually do a mix, some ground-level plots for people who prefer traditional growing, some raised beds, and always a few communal beds that everyone contributes to. The communal beds are important because they give new members something to do immediately while they wait for a plot to free up. Now here's the thing people get wrong. They fill the entire space with growing beds. You need communal space. A covered area with a table and chairs. A tea-making station if possible. I'm not joking when I say the tea-drinking area is as important as the growing beds. That's where the community actually happens. People share tips, make friends, plan events. Without it, you just have individuals gardening near each other, not a community. For layout, put the water point centrally. Put the compost bays at the back where they won't bother anyone. Main paths should be minimum 1.2 metres wide for wheelchair access. Plot sizes of 3x4 metres work well for individuals, big enough to be worthwhile but small enough that they don't become overwhelming." },
          ],
          validation: {
            meets_goal: true,
            confidence: 0.93,
            explanation: "Comprehensive design principles covering accessibility, communal space, and practical layout guidelines.",
            missing_aspects: [],
            extracted_data: {
              key_points: [
                "Design for least experienced/able member",
                "Raised beds at 60cm standard, 75-80cm for wheelchair access",
                "Communal space is essential, not optional",
                "1.2m minimum path width, 3x4m plot size",
              ],
              relevant_quotes: [
                "The tea-drinking area is as important as the growing beds",
              ],
            },
          },
          extractions: [
            { type: "decision_rule", content: "Design the garden for the least experienced, least able-bodied member. If it works for them, it works for everyone.", confidence: 0.95, tags: ["design", "accessibility", "principle"] },
            { type: "procedure", content: "Garden layout: Mix of ground-level plots, raised beds (60cm standard, 75-80cm wheelchair-accessible with clearance underneath), and communal beds. Include covered communal area with seating. Central water point. Compost bays at rear. 1.2m minimum path width. 3x4m individual plots.", confidence: 0.94, tags: ["design", "layout", "infrastructure"] },
            { type: "tip", content: "Include communal growing beds alongside individual plots. They give new members something to do immediately while waiting for their own plot, and build shared ownership.", confidence: 0.92, tags: ["design", "community", "engagement"] },
            { type: "warning", content: "Don't fill the entire space with growing beds. A communal gathering area with seating and tea-making is essential. Without it, you have individuals gardening near each other, not a community.", confidence: 0.94, tags: ["design", "community", "common-mistake"] },
            { type: "metric", content: "Raised bed heights: 60cm standard (no bending), 75-80cm for wheelchair access with clearance underneath. Individual plot size: 3x4 metres.", confidence: 0.93, tags: ["design", "accessibility", "dimensions"] },
          ],
        },
        {
          text: "What infrastructure does a community garden need on day one?",
          goal: "Define minimum viable infrastructure",
          messages: [
            { role: "assistant", content: "What's the minimum infrastructure you need to actually open and start gardening?" },
            { role: "user", content: "Water, storage, and paths. That's your day one. Water supply is absolutely critical. You need a tap connected to mains or a reliable rainwater harvesting system. No water, no garden. We budget about 20% of initial funding just for water infrastructure. Tool storage needs to be secure. A lockable shipping container is brilliant and relatively cheap, maybe 500 to 1000 pounds secondhand. You need basic communal tools: spades, forks, rakes, wheelbarrows, watering cans, a hose. Don't buy premium tools, buy mid-range and lots of them. Tools go missing and break. Paths need to be firm, level, and ideally accessible. Wood chip is the cheapest option and works well but needs topping up annually. We've also used recycled rubber matting for wheelchair routes. Everything else is phase two. Raised beds can be built over time. A shed or covered area can wait. Composting infrastructure can be as simple as a pallet bin to start. One thing I would invest in early though is a noticeboard and some signage. Sounds trivial but it communicates 'this is organised and looked after' to passers-by and potential troublemakers. A well-signed garden gets less vandalism." },
          ],
          validation: {
            meets_goal: true,
            confidence: 0.90,
            explanation: "Clear minimum viable infrastructure defined with practical cost guidance and phasing advice.",
            missing_aspects: ["insurance and legal requirements"],
            extracted_data: {
              key_points: [
                "Day one: water, tool storage, paths",
                "20% of funding for water infrastructure",
                "Shipping container for tool storage: 500-1000 GBP",
                "Mid-range tools, buy quantity over quality",
                "Signage reduces vandalism",
              ],
              relevant_quotes: [
                "A well-signed garden gets less vandalism",
              ],
            },
          },
          extractions: [
            { type: "procedure", content: "Day-one infrastructure: (1) Water supply - mains tap or rainwater harvesting, budget 20% of initial funding, (2) Secure tool storage - lockable shipping container (500-1000 GBP secondhand), (3) Firm level paths - wood chip (cheapest, needs annual topping up) or recycled rubber matting for wheelchair routes.", confidence: 0.94, tags: ["infrastructure", "getting-started", "budget"] },
            { type: "tip", content: "Buy mid-range communal tools in quantity, not premium individual tools. Tools go missing and break in community settings. Essential set: spades, forks, rakes, wheelbarrows, watering cans, hose.", confidence: 0.91, tags: ["equipment", "budget", "practical"] },
            { type: "tip", content: "Invest early in a noticeboard and clear signage. It communicates 'organised and looked after' to passers-by and reduces vandalism.", confidence: 0.89, tags: ["infrastructure", "security", "communication"] },
            { type: "decision_rule", content: "Phase your build. Day one: water, storage, paths. Phase two: raised beds, covered area, composting. Start simple with pallet compost bins and build up over time.", confidence: 0.90, tags: ["planning", "phasing", "budget"] },
          ],
        },
      ],
    },
    {
      title: "Community Organisation & Governance",
      goal: "Understand the social and organisational side",
      summary: {
        summary: "Priya recommends a simple committee structure with clear roles, regular meetings, and transparent decision-making. Conflict resolution should be proactive through clear rules and early intervention rather than reactive.",
        key_points: [
          "Small committee with defined roles",
          "Monthly meetings, open to all",
          "Written rules agreed upfront prevent most conflicts",
          "Address issues early before they escalate",
        ],
        themes: ["transparency", "prevention", "shared ownership"],
        notable_quotes: [
          "90% of garden conflicts come from unclear expectations. Write it down before there's a problem.",
        ],
        metadata: {
          completion_quality: 0.87,
          main_topics: ["governance", "conflict resolution", "rules"],
        },
      },
      questions: [
        {
          text: "How do you structure the organisation and decision-making?",
          goal: "Document governance models",
          messages: [
            { role: "assistant", content: "Let's talk about the organisational side. How do you structure the group so decisions get made and things actually happen?" },
            { role: "user", content: "Keep it simple. You need a committee of 5-7 people with clear roles: chair, treasurer, secretary, and a couple of general members. Don't make the committee too big or nothing gets decided. The committee handles operational decisions, things like when to open, what to spend money on, maintenance schedules. But big decisions, like changing the rules, adding new infrastructure, or spending above a threshold, should go to an open meeting where all members can vote. We run monthly open meetings and they're crucial. Not just for decisions but for building community. People need to feel heard. If you make all decisions behind closed doors, you'll create resentment. One model that works brilliantly is giving plot holders responsibility for communal tasks on a rota. One month you're responsible for mowing communal paths. Next month it's composting. It spreads the workload and gives everyone a sense of ownership beyond their own plot. For communication, a WhatsApp group works for 80% of things. We also have a simple shared Google calendar with key dates: workdays, meetings, planting deadlines, seasonal events." },
          ],
          validation: {
            meets_goal: true,
            confidence: 0.91,
            explanation: "Clear governance structure with committee composition, decision-making tiers, and practical communication tools.",
            missing_aspects: ["formal constitution template"],
            extracted_data: {
              key_points: [
                "Committee of 5-7 with clear roles",
                "Two-tier decisions: committee for operational, open meeting for big changes",
                "Monthly open meetings are essential",
                "Communal task rota builds shared ownership",
              ],
              relevant_quotes: [
                "If you make all decisions behind closed doors, you'll create resentment",
              ],
            },
          },
          extractions: [
            { type: "procedure", content: "Governance structure: Committee of 5-7 (chair, treasurer, secretary, 2-4 general members). Committee handles operational decisions. Big decisions (rule changes, major spend, new infrastructure) go to monthly open meeting where all members vote.", confidence: 0.93, tags: ["governance", "organisation", "decision-making"] },
            { type: "tip", content: "Create a communal task rota where plot holders take turns on shared responsibilities (path mowing, composting, etc). Spreads workload and builds ownership beyond individual plots.", confidence: 0.91, tags: ["governance", "engagement", "workload"] },
            { type: "tip", content: "Use WhatsApp for 80% of communication and a shared Google calendar for key dates (workdays, meetings, planting deadlines, seasonal events).", confidence: 0.88, tags: ["communication", "tools", "practical"] },
            { type: "warning", content: "Don't make committee too large or nothing gets decided. Keep it to 5-7 people. But never make big decisions behind closed doors - always take major changes to open meetings.", confidence: 0.90, tags: ["governance", "transparency"] },
          ],
        },
        {
          text: "How do you handle conflicts between plot holders?",
          goal: "Capture conflict resolution approaches",
          messages: [
            { role: "assistant", content: "With lots of people sharing space, conflicts must come up. How do you handle disagreements between members?" },
            { role: "user", content: "Prevention is 90% of the job. Most conflicts come from unclear expectations. So we have a simple membership agreement that everyone signs when they join. It covers: plot maintenance standards (you must keep your plot reasonably tidy), communal area responsibilities, what you can and can't build on your plot, noise and behaviour expectations, and what happens if you don't use your plot for extended periods. We define 'abandoned' as no activity for 8 weeks during growing season without notifying the committee. Having all of that written down and agreed upfront prevents most problems before they start. When conflicts do arise, usually it's about boundaries, someone's plants growing into a neighbour's plot, or mess, someone leaving tools around. Our process is: first, a friendly word. Most things can be sorted with a conversation. If that doesn't work, a committee member has a quiet chat with both parties separately. If it still persists, it goes to the committee for a formal decision. In three years at our main garden we've only had to formally intervene twice. Both times it was about the same thing, someone essentially claiming communal space as their own. The key is acting early. If you let things fester, positions harden and it becomes much harder to resolve." },
          ],
          validation: {
            meets_goal: true,
            confidence: 0.92,
            explanation: "Clear conflict prevention and resolution framework with escalation levels and real examples.",
            missing_aspects: [],
            extracted_data: {
              key_points: [
                "Written membership agreement prevents most conflicts",
                "Three-tier resolution: friendly word, committee chat, formal decision",
                "8 weeks = abandoned during growing season",
                "Act early before positions harden",
              ],
              relevant_quotes: [
                "90% of garden conflicts come from unclear expectations. Write it down before there's a problem.",
              ],
            },
          },
          extractions: [
            { type: "procedure", content: "Conflict resolution escalation: (1) Friendly word between parties, (2) Committee member chats separately with both parties, (3) Formal committee decision. Act early before positions harden.", confidence: 0.94, tags: ["conflict", "governance", "process"] },
            { type: "procedure", content: "Membership agreement should cover: plot maintenance standards, communal area responsibilities, building restrictions, noise/behaviour expectations, and inactivity policy (8 weeks without activity during growing season = abandoned without prior notice to committee).", confidence: 0.93, tags: ["governance", "rules", "prevention"] },
            { type: "tip", content: "Prevention is 90% of conflict management. Write clear expectations down and have everyone sign before there's a problem. Most garden conflicts stem from unclear expectations.", confidence: 0.95, tags: ["conflict", "prevention", "governance"] },
            { type: "example", content: "Most common formal conflicts involve members claiming communal space as their own. Having clear boundaries and written rules makes these easier to resolve through the committee.", confidence: 0.88, tags: ["conflict", "example"] },
          ],
        },
      ],
    },
    {
      title: "Growing & Seasonal Planning",
      goal: "Practical growing advice for the group",
      summary: {
        summary: "First-year growing should focus on reliable, fast-reward crops to build confidence. Year-round engagement requires seasonal events, winter projects, and social activities beyond gardening.",
        key_points: [
          "Start with quick-win crops (radish, lettuce, herbs)",
          "Plan for 3 growing seasons in the first year",
          "Winter is for social events, planning, and infrastructure",
          "Seasonal celebrations maintain engagement year-round",
        ],
        themes: ["quick wins", "confidence building", "year-round engagement"],
        notable_quotes: [
          "Nothing keeps someone coming back like eating something they grew themselves. Make that happen fast.",
        ],
        metadata: {
          completion_quality: 0.86,
          main_topics: ["crop selection", "seasonal planning", "engagement"],
        },
      },
      questions: [
        {
          text: "What should a new community garden grow in its first year?",
          goal: "Identify beginner-friendly crops and planning",
          messages: [
            { role: "assistant", content: "For a garden full of beginners, what should they actually grow in that first year?" },
            { role: "user", content: "The goal in year one is success, not sophistication. You want crops that are almost impossible to fail and give a fast reward. Radishes are my number one recommendation. Seed to harvest in 4 weeks, nearly impossible to kill, and the look on someone's face when they pull their first radish out of the ground is priceless. Lettuce and salad leaves are next, harvest within 6 weeks and you can do cut-and-come-again so they keep producing. Courgettes are brilliant because they produce so abundantly people end up giving them away, which feels amazing. Runner beans for vertical interest and a long harvest period. And herbs, specifically basil, coriander, mint, and parsley. Herbs are wonderful because people can use them in cooking that same evening. For the communal beds I'd suggest potatoes. They're enormously satisfying to dig up, everyone can help, and they store well. Plus digging potatoes is a brilliant community event, we turn our potato harvest into a mini festival with soup made from the crop. What I'd avoid in year one: anything that takes a full season to mature with no visible progress, like parsnips or winter squash. You need quick dopamine hits to keep new gardeners engaged." },
          ],
          validation: {
            meets_goal: true,
            confidence: 0.93,
            explanation: "Excellent crop selection guidance focused on beginner success with specific timelines and reasoning.",
            missing_aspects: [],
            extracted_data: {
              key_points: [
                "Radishes: 4-week harvest, nearly impossible to fail",
                "Lettuce/salad: 6 weeks, cut-and-come-again",
                "Courgettes: abundant production",
                "Herbs for same-evening cooking use",
                "Potatoes in communal beds for harvest events",
              ],
              relevant_quotes: [
                "Nothing keeps someone coming back like eating something they grew themselves",
              ],
            },
          },
          extractions: [
            { type: "procedure", content: "Year-one crop plan for beginners: Quick wins - radishes (4 weeks), lettuce/salad (6 weeks, cut-and-come-again), courgettes (abundant, sharable). Vertical interest - runner beans. Herbs - basil, coriander, mint, parsley (use same evening). Communal beds - potatoes (satisfying to dig, stores well, makes great harvest events).", confidence: 0.94, tags: ["growing", "beginner", "planning"] },
            { type: "decision_rule", content: "In year one, choose crops for speed and certainty, not sophistication. Avoid anything taking a full season with no visible progress (parsnips, winter squash). New gardeners need quick dopamine hits to stay engaged.", confidence: 0.95, tags: ["growing", "engagement", "strategy"] },
            { type: "tip", content: "Turn potato harvest day into a community festival. Make soup from the crop. It creates a memorable event and reinforces the connection between growing and eating.", confidence: 0.90, tags: ["events", "community", "engagement"] },
            { type: "example", content: "Courgettes produce so abundantly that new gardeners end up giving them away to neighbours, which creates a feel-good feedback loop that keeps them coming back.", confidence: 0.88, tags: ["growing", "motivation", "beginner"] },
          ],
        },
        {
          text: "How do you keep the garden going through winter and maintain momentum?",
          goal: "Capture year-round engagement strategies",
          messages: [
            { role: "assistant", content: "What happens when the growing season ends? How do you keep people engaged through winter?" },
            { role: "user", content: "Winter is where most community gardens lose people and struggle to recover in spring. You have to be proactive about it. First, there's still growing to do. Garlic goes in October and November. Winter salads like lamb's lettuce and winter purslane work well under cloches. Broad beans can be sown in November for an early spring harvest. So the garden doesn't have to go completely dormant. Second, winter is project season. Build new raised beds. Fix the paths. Repair the shed. Paint things. These communal work days keep people connected and give a sense of progress. Third, and this is the big one, social events. We do a bonfire night in November. A wreath-making workshop in December using garden foliage. A seed swap in January. A planning meeting in February where we lay out the whole year ahead. Each event gives people a reason to come down even when there's nothing to harvest. Fourth, use the quiet months for planning and education. Run a composting workshop. Invite a beekeeper to talk. Do a soil-testing session. People love learning when they don't feel pressured to also be digging. The gardens that thrive are the ones that understand they're not just about growing vegetables. They're about community. And community needs year-round nurturing." },
          ],
          validation: {
            meets_goal: true,
            confidence: 0.92,
            explanation: "Comprehensive year-round engagement strategy covering winter growing, projects, events, and education.",
            missing_aspects: [],
            extracted_data: {
              key_points: [
                "Winter growing: garlic, winter salads, broad beans",
                "Project season for infrastructure improvements",
                "Social events each month through winter",
                "Education workshops during quiet months",
              ],
              relevant_quotes: [
                "The gardens that thrive are the ones that understand they're not just about growing vegetables. They're about community.",
              ],
            },
          },
          extractions: [
            { type: "procedure", content: "Winter engagement programme: (1) Continue growing - garlic (Oct-Nov), winter salads under cloches, broad beans (Nov), (2) Infrastructure projects - build beds, fix paths, repairs, (3) Monthly social events - bonfire night (Nov), wreath-making (Dec), seed swap (Jan), year planning (Feb), (4) Education workshops - composting, beekeeping talks, soil testing.", confidence: 0.94, tags: ["seasonal", "engagement", "winter"] },
            { type: "warning", content: "Winter is where most community gardens lose members and struggle to recover in spring. Must be proactive with events, projects, and continued growing to maintain momentum.", confidence: 0.93, tags: ["seasonal", "retention", "risk"] },
            { type: "tip", content: "Use February for a full year planning meeting where the whole community maps out the growing season ahead. Gives everyone ownership of the plan and excitement for spring.", confidence: 0.90, tags: ["planning", "engagement", "community"] },
            { type: "fact", content: "Community gardens that thrive understand they're about community, not just growing. Year-round social programming is as important as horticultural planning.", confidence: 0.91, tags: ["philosophy", "sustainability", "community"] },
          ],
        },
      ],
    },
  ],
}

// ============ Export all fixtures ============

export const allInterviews = [foodBankInterview, sourdoughInterview, communityGardenInterview]
