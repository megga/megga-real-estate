import { Navigate } from 'react-router-dom'

export default function LouerPage() {
  return <Navigate to="/search?context=rent" replace />
}
