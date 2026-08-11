import { Users, Sandwich, Moon, Heart, Laptop, PartyPopper, Sparkles } from 'lucide-react'

/**
 * Maps the `icon` name stored on a mood row to a real lucide component.
 *
 * Resolving through this table rather than a dynamic lookup means a mood added
 * later with an unknown icon name degrades to the Sparkles fallback instead of
 * crashing the page.
 */
const ICONS = {
  Users,
  Sandwich,
  Moon,
  Heart,
  Laptop,
  PartyPopper,
}

export const moodIcon = (name) => ICONS[name] || Sparkles

/** Renders a mood's icon at the given size. */
export function MoodIcon({ icon, size = 15, className = '' }) {
  const Icon = moodIcon(icon)
  return <Icon size={size} className={className} />
}
