import {
  Users, Sandwich, Moon, Heart, Laptop, PartyPopper, Sparkles,
  Coffee, Utensils, Pizza, Cake, IceCream, Soup, Beer, Wine, GlassWater,
  Music, Gamepad2, Dumbbell, ShoppingBag, Camera, BookOpen, Briefcase,
  Sun, Snowflake, Flame, Leaf, Mountain, Waves, Palmtree, Tent,
  Baby, Dog, Cat, Smile, Star, Gift, Trophy, Bike, Car, Plane, Wifi,
} from 'lucide-react'

/**
 * Maps the `icon` name stored on a mood row to a real lucide component.
 *
 * Resolving through this table rather than a dynamic lookup means a mood added
 * later with an unknown icon name degrades to the Sparkles fallback instead of
 * crashing the page.
 */
const ICONS = {
  Users, Sandwich, Moon, Heart, Laptop, PartyPopper, Sparkles,
  Coffee, Utensils, Pizza, Cake, IceCream, Soup, Beer, Wine, GlassWater,
  Music, Gamepad2, Dumbbell, ShoppingBag, Camera, BookOpen, Briefcase,
  Sun, Snowflake, Flame, Leaf, Mountain, Waves, Palmtree, Tent,
  Baby, Dog, Cat, Smile, Star, Gift, Trophy, Bike, Car, Plane, Wifi,
}

/**
 * The names an admin can choose from when creating a mood. Keeping the picker
 * bound to this list means every saved icon is one the site can actually draw.
 */
export const MOOD_ICON_NAMES = Object.keys(ICONS)

export const moodIcon = (name) => ICONS[name] || Sparkles

/** Renders a mood's icon at the given size. */
export function MoodIcon({ icon, size = 15, className = '' }) {
  const Icon = moodIcon(icon)
  return <Icon size={size} className={className} />
}
