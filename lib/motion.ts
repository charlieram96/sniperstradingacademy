import type { Variants, Transition } from "framer-motion"

// Spring presets
export const spring = {
  gentle: { type: "spring", stiffness: 120, damping: 14 } as Transition,
  snappy: { type: "spring", stiffness: 300, damping: 20 } as Transition,
  bouncy: { type: "spring", stiffness: 400, damping: 15 } as Transition,
  smooth: { type: "spring", stiffness: 200, damping: 24 } as Transition,
}

// Easing presets
export const ease = {
  out: [0.16, 1, 0.3, 1] as [number, number, number, number],
  inOut: [0.4, 0, 0.2, 1] as [number, number, number, number],
}

// Fade in
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.4, ease: ease.out } },
}

// Fade in + slide up
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: ease.out },
  },
}

// Fade in + slide down
export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: ease.out },
  },
}

// Slide in from right
export const slideInFromRight: Variants = {
  hidden: { opacity: 0, x: 24 },
  visible: {
    opacity: 1,
    x: 0,
    transition: spring.gentle,
  },
}

// Slide in from left
export const slideInFromLeft: Variants = {
  hidden: { opacity: 0, x: -24 },
  visible: {
    opacity: 1,
    x: 0,
    transition: spring.gentle,
  },
}

// Scale up (for modals/dialogs)
export const scaleUp: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: spring.snappy,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.15 },
  },
}

// Stagger container
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.1,
    },
  },
}

// Stagger item
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: ease.out },
  },
}

// Table row stagger (faster)
export const tableRowStagger: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.03,
    },
  },
}

export const tableRowItem: Variants = {
  hidden: { opacity: 0, x: -8 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.3, ease: ease.out },
  },
}

// Page transition
export const pageTransition: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: ease.out },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.15 },
  },
}

// Dropdown/popover open
export const dropdownAnimation: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.96,
    y: -4,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: spring.snappy,
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: -4,
    transition: { duration: 0.1 },
  },
}

// Sidebar expand/collapse
export const sidebarAnimation: Variants = {
  expanded: {
    width: 260,
    transition: spring.smooth,
  },
  collapsed: {
    width: 72,
    transition: spring.smooth,
  },
}

// Sidebar mobile overlay
export const sidebarOverlay: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
}

export const sidebarMobile: Variants = {
  hidden: { x: -260 },
  visible: { x: 0, transition: spring.smooth },
  exit: { x: -260, transition: { duration: 0.2 } },
}

export const sidebarMobileRight: Variants = {
  hidden: { x: 320 },
  visible: { x: 0, transition: spring.smooth },
  exit: { x: 320, transition: { duration: 0.2 } },
}

// Micro interactions
export const buttonTap = { scale: 0.98 }
export const buttonHover = { y: -1 }

// whileInView defaults
export const viewportOnce = { once: true, margin: "-60px" as const }
