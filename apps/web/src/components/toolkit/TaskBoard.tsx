import { useState } from 'react'
import {
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  Calendar,
  Clock,
  Repeat,
  ArrowRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import type { TaskBoardConfig, TaskBoardTask } from '@forge/shared'
import { useTaskBoardState } from '../../hooks/useTaskBoardState'

type ColumnId = 'todo' | 'in_progress' | 'done'

interface TaskBoardProps {
  config: TaskBoardConfig
  forgeId: string
  onNavigateToComponent?: (componentId: string) => void
}

const frequencyConfig = {
  weekly: { label: 'Weekly', icon: Repeat, color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  monthly: { label: 'Monthly', icon: Calendar, color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  as_needed: { label: 'As needed', icon: Clock, color: 'bg-slate-600/40 text-slate-300 border-slate-500/30' },
}

const columnConfig: Record<ColumnId, { title: string; headerBg: string; headerText: string; countBg: string; countText: string; bodyBg: string }> = {
  todo: {
    title: 'To Do',
    headerBg: 'bg-slate-700/50',
    headerText: 'text-slate-300',
    countBg: 'bg-slate-600/50',
    countText: 'text-slate-300',
    bodyBg: 'bg-slate-800/30',
  },
  in_progress: {
    title: 'In Progress',
    headerBg: 'bg-amber-500/10',
    headerText: 'text-amber-300',
    countBg: 'bg-amber-500/20',
    countText: 'text-amber-300',
    bodyBg: 'bg-amber-900/5',
  },
  done: {
    title: 'Done',
    headerBg: 'bg-green-500/10',
    headerText: 'text-green-300',
    countBg: 'bg-green-500/20',
    countText: 'text-green-300',
    bodyBg: 'bg-green-900/5',
  },
}

function TaskCard({
  task,
  columnId,
  onMove,
  onNavigateToComponent,
}: {
  task: TaskBoardTask
  columnId: ColumnId
  onMove: (taskId: string, to: ColumnId) => void
  onNavigateToComponent?: (componentId: string) => void
}) {
  const freq = frequencyConfig[task.frequency]
  const FreqIcon = freq.icon

  return (
    <div className="bg-slate-800/50 border border-slate-700/50  p-3 group hover:border-slate-600/50 transition-colors">
      <div className="text-sm font-medium text-slate-200 leading-snug">
        {task.text}
      </div>

      {task.description && (
        <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
          {task.description}
        </p>
      )}

      <div className="flex items-center justify-between mt-2.5 gap-2">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          {/* Frequency badge */}
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mediumborder ${freq.color}`}>
            <FreqIcon className="w-2.5 h-2.5" />
            {freq.label}
          </span>

          {/* Category badge */}
          {task.category && (
            <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-mediumborder bg-slate-700/40 text-slate-400 border-slate-600/40">
              {task.category}
            </span>
          )}

          {/* Linked component */}
          {task.linkedComponentId && task.linkedComponentTitle && onNavigateToComponent && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onNavigateToComponent(task.linkedComponentId!)
              }}
              className="inline-flex items-center gap-0.5 text-[10px] text-orange-400 hover:text-orange-300 transition-colors"
            >
              <ArrowRight className="w-2.5 h-2.5" />
              Open {task.linkedComponentTitle}
            </button>
          )}
        </div>

        {/* Move buttons */}
        <div className="flex items-center gap-0.5 shrink-0">
          {columnId === 'todo' && (
            <button
              onClick={() => onMove(task.id, 'in_progress')}
              className="p-1 text-slate-500 hover:text-orange-400 hover:bg-slate-700/50transition-colors"
              title="Move to In Progress"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
          {columnId === 'in_progress' && (
            <>
              <button
                onClick={() => onMove(task.id, 'todo')}
                className="p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-700/50transition-colors"
                title="Move to To Do"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => onMove(task.id, 'done')}
                className="p-1 text-slate-500 hover:text-green-400 hover:bg-slate-700/50transition-colors"
                title="Move to Done"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}
          {columnId === 'done' && (
            <button
              onClick={() => onMove(task.id, 'in_progress')}
              className="p-1 text-slate-500 hover:text-amber-400 hover:bg-slate-700/50transition-colors"
              title="Move to In Progress"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Column({
  columnId,
  tasks,
  onMove,
  onNavigateToComponent,
  collapsible,
}: {
  columnId: ColumnId
  tasks: TaskBoardTask[]
  onMove: (taskId: string, to: ColumnId) => void
  onNavigateToComponent?: (componentId: string) => void
  collapsible?: boolean
}) {
  const [collapsed, setCollapsed] = useState(false)
  const cfg = columnConfig[columnId]

  return (
    <div className={` border border-slate-700/50 overflow-hidden flex flex-col ${cfg.bodyBg}`}>
      {/* Column header */}
      <div
        className={`px-4 py-3 ${cfg.headerBg} flex items-center justify-between ${collapsible ? 'cursor-pointer' : ''}`}
        onClick={collapsible ? () => setCollapsed((c) => !c) : undefined}
      >
        <div className="flex items-center gap-2">
          <h4 className={`text-sm font-semibold ${cfg.headerText}`}>
            {cfg.title}
          </h4>
          <span className={`text-xs font-medium px-1.5 py-0.5${cfg.countBg} ${cfg.countText}`}>
            {tasks.length}
          </span>
        </div>
        {collapsible && (
          collapsed
            ? <ChevronDown className={`w-4 h-4 ${cfg.headerText}`} />
            : <ChevronUp className={`w-4 h-4 ${cfg.headerText}`} />
        )}
      </div>

      {/* Card list */}
      {!collapsed && (
        <div className="p-2 space-y-2 max-h-[500px] overflow-y-auto flex-1">
          {tasks.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500 italic">
              No tasks
            </div>
          ) : (
            tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                columnId={columnId}
                onMove={onMove}
                onNavigateToComponent={onNavigateToComponent}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default function TaskBoard({ config, forgeId, onNavigateToComponent }: TaskBoardProps) {
  const { columns, moveTask, resetWeek, weekStartDate, stats } = useTaskBoardState(
    forgeId,
    config.tasks
  )

  const formattedWeekStart = weekStartDate.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <div className="space-y-4">
      {/* Week header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span>Week of {formattedWeekStart}</span>
        </div>

        <div className="text-xs text-slate-400">
          <span className="text-green-400 font-medium">{stats.completed}</span>
          <span>/{stats.total} done this week</span>
        </div>

        <button
          onClick={resetWeek}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-orange-400 bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50  transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          Reset Week
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-slate-700  overflow-hidden">
        <div
          className="h-full bg-green-500  transition-all duration-300"
          style={{ width: `${stats.percentage}%` }}
        />
      </div>

      {/* Columns - 3-column grid on md+, stacked on mobile */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Column
          columnId="todo"
          tasks={columns.todo}
          onMove={moveTask}
          onNavigateToComponent={onNavigateToComponent}
          collapsible
        />
        <Column
          columnId="in_progress"
          tasks={columns.inProgress}
          onMove={moveTask}
          onNavigateToComponent={onNavigateToComponent}
          collapsible
        />
        <Column
          columnId="done"
          tasks={columns.done}
          onMove={moveTask}
          onNavigateToComponent={onNavigateToComponent}
          collapsible
        />
      </div>
    </div>
  )
}
