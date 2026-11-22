import { Link } from 'react-router-dom'
import { Page, buttonPrimary } from '../components/ui.jsx'

export default function NotFound() {
  return (
    <Page>
      <div className="py-20 text-center">
        <h1 className="text-3xl font-bold text-brand-900">Page not found</h1>
        <p className="mt-2 text-slate-600">The page you are looking for does not exist.</p>
        <Link to="/" className={`${buttonPrimary} mt-6`}>
          Go to Home
        </Link>
      </div>
    </Page>
  )
}
