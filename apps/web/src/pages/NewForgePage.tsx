import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { createDraftForge } from '../lib/api'

export default function NewForgePage() {
  const navigate = useNavigate()
  const creatingRef = useRef(false)

  useEffect(() => {
    if (creatingRef.current) return
    creatingRef.current = true

    createDraftForge()
      .then((forge) => {
        navigate(`/forge/${forge.id}/interview`, { replace: true })
      })
      .catch((err) => {
        console.error('Failed to create forge:', err)
        creatingRef.current = false
        navigate('/forges')
      })
  }, [navigate])

  return (
    <div className="h-screen flex items-center justify-center">
      <div className="flex items-center gap-3 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin" />
        Setting up...
      </div>
    </div>
  )
}
