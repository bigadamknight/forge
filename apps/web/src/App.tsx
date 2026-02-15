import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import NewForgePage from './pages/NewForgePage'
import InterviewPage from './pages/InterviewPage'
import DocumentUploadPage from './pages/DocumentUploadPage'
import ToolViewPage from './pages/ToolViewPage'

export default function App() {
  return (
    <div className="min-h-screen">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/forge/new" element={<NewForgePage />} />
        <Route path="/forge/:forgeId/interview" element={<InterviewPage />} />
        <Route path="/forge/:forgeId/documents" element={<DocumentUploadPage />} />
        <Route path="/forge/:forgeId/tool" element={<ToolViewPage />} />
      </Routes>
    </div>
  )
}
