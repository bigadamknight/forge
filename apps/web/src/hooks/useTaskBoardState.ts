import { useState, useCallback, useMemo } from 'react'
import type { TaskBoardTask } from '@forge/shared'

type ColumnId = 'todo' | 'in_progress' | 'done'

interface TaskBoardState {
  columns: { todo: string[]; in_progress: string[]; done: string[] }
  lastResetAt: string
}

function getLastMonday(): Date {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? 6 : day - 1
  const monday = new Date(now)
  monday.setDate(now.getDate() - diff)
  monday.setHours(0, 0, 0, 0)
  return monday
}

function getStorageKey(forgeId: string): string {
  return `ops-board-${forgeId}`
}

function loadState(forgeId: string): TaskBoardState | null {
  try {
    const raw = localStorage.getItem(getStorageKey(forgeId))
    if (!raw) return null
    return JSON.parse(raw) as TaskBoardState
  } catch {
    return null
  }
}

function saveState(forgeId: string, state: TaskBoardState): void {
  try {
    localStorage.setItem(getStorageKey(forgeId), JSON.stringify(state))
  } catch {}
}

function reconcileState(saved: TaskBoardState, tasks: TaskBoardTask[]): TaskBoardState {
  const taskIds = new Set(tasks.map((t) => t.id))

  // Remove task IDs that no longer exist
  const todo = saved.columns.todo.filter((id) => taskIds.has(id))
  const inProgress = saved.columns.in_progress.filter((id) => taskIds.has(id))
  const done = saved.columns.done.filter((id) => taskIds.has(id))

  // Find tasks not in any column and add to todo
  const assignedIds = new Set([...todo, ...inProgress, ...done])
  for (const task of tasks) {
    if (!assignedIds.has(task.id)) {
      todo.push(task.id)
    }
  }

  return {
    columns: { todo, in_progress: inProgress, done },
    lastResetAt: saved.lastResetAt,
  }
}

function initializeState(forgeId: string, tasks: TaskBoardTask[]): TaskBoardState {
  const saved = loadState(forgeId)
  const monday = getLastMonday()

  if (!saved) {
    const state: TaskBoardState = {
      columns: {
        todo: tasks.map((t) => t.id),
        in_progress: [],
        done: [],
      },
      lastResetAt: monday.toISOString(),
    }
    saveState(forgeId, state)
    return state
  }

  // Reconcile with current tasks (handles regeneration)
  let state = reconcileState(saved, tasks)

  // Weekly auto-reset: if lastResetAt is before this Monday, move done → todo
  const lastReset = new Date(state.lastResetAt)
  if (lastReset < monday) {
    state = {
      columns: {
        todo: [...state.columns.todo, ...state.columns.done],
        in_progress: state.columns.in_progress,
        done: [],
      },
      lastResetAt: monday.toISOString(),
    }
  }

  saveState(forgeId, state)
  return state
}

export function useTaskBoardState(forgeId: string, tasks: TaskBoardTask[]) {
  const [state, setState] = useState<TaskBoardState>(() =>
    initializeState(forgeId, tasks)
  )

  const taskMap = useMemo(() => {
    const map = new Map<string, TaskBoardTask>()
    for (const task of tasks) {
      map.set(task.id, task)
    }
    return map
  }, [tasks])

  const resolveIds = useCallback(
    (ids: string[]): TaskBoardTask[] =>
      ids.map((id) => taskMap.get(id)).filter(Boolean) as TaskBoardTask[],
    [taskMap]
  )

  const columns = useMemo(
    () => ({
      todo: resolveIds(state.columns.todo),
      inProgress: resolveIds(state.columns.in_progress),
      done: resolveIds(state.columns.done),
    }),
    [state, resolveIds]
  )

  const moveTask = useCallback(
    (taskId: string, to: ColumnId) => {
      setState((prev) => {
        const next: TaskBoardState = {
          ...prev,
          columns: {
            todo: prev.columns.todo.filter((id) => id !== taskId),
            in_progress: prev.columns.in_progress.filter((id) => id !== taskId),
            done: prev.columns.done.filter((id) => id !== taskId),
          },
        }
        next.columns[to].push(taskId)
        saveState(forgeId, next)
        return next
      })
    },
    [forgeId]
  )

  const resetWeek = useCallback(() => {
    setState((prev) => {
      const next: TaskBoardState = {
        columns: {
          todo: [...prev.columns.todo, ...prev.columns.done],
          in_progress: prev.columns.in_progress,
          done: [],
        },
        lastResetAt: getLastMonday().toISOString(),
      }
      saveState(forgeId, next)
      return next
    })
  }, [forgeId])

  const weekStartDate = useMemo(() => getLastMonday(), [])

  const stats = useMemo(() => {
    const total = tasks.length
    const completed = state.columns.done.length
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0
    return { total, completed, percentage }
  }, [tasks.length, state.columns.done.length])

  return {
    columns,
    moveTask,
    resetWeek,
    weekStartDate,
    stats,
  }
}
