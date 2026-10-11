import { Sprout } from 'lucide-react'
export default function BrandMark({ compact = false }) {
  return <span className={`brand-mark ${compact ? 'brand-mark--compact' : ''}`} aria-hidden="true"><Sprout size={compact ? 23 : 28} strokeWidth={2.1} /></span>
}
