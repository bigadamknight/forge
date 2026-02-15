import {
  GitBranch,
  CheckSquare,
  Calculator,
  Info,
  ListOrdered,
  HelpCircle,
  Award,
  Columns,
  BookOpen,
  ShieldAlert,
  KanbanSquare,
  Puzzle,
  type LucideIcon,
} from 'lucide-react'

export const COMPONENT_ICONS: Record<string, LucideIcon> = {
  decision_tree: GitBranch,
  checklist: CheckSquare,
  calculator: Calculator,
  info_card: Info,
  step_by_step: ListOrdered,
  question_flow: HelpCircle,
  score_card: Award,
  comparison_table: Columns,
  context_panel: BookOpen,
  risk_assessment: ShieldAlert,
  task_board: KanbanSquare,
  custom: Puzzle,
}

export function getComponentIcon(type: string): LucideIcon {
  return COMPONENT_ICONS[type] || Puzzle
}
