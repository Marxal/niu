/*
 * Every piece of user-facing text in the app, in one place.
 *
 * Why this file exists: round 1 shipped with Catalan hand-typed inline across
 * five components, on a guess about who'd be using it. Guessing wrong meant
 * editing every one of those files a second time. Keeping the strings here
 * instead means a future translation (or a language switch) touches this file
 * only — no component needs to change.
 *
 * This is English text with no translation mechanism behind it yet. If Niu
 * ever needs a second language, this file is what becomes `en.ts`, sitting
 * next to a `ca.ts` with the same keys.
 */

export const strings = {
  app: {
    name: 'Niu',
    description: 'Our household organiser: shopping, meals and the calendar.',
  },

  tabs: {
    shopping: { label: 'Shopping', title: 'Shopping list' },
    meals: { label: 'Meals', title: 'Meal planner' },
    calendar: { label: 'Calendar', title: 'Shared calendar' },
  },

  header: {
    settings: 'Settings',
    closeSettings: 'Close settings',
  },

  nav: {
    label: 'Main sections',
  },

  placeholder: {
    tag: 'Not built yet',
  },

  screens: {
    shopping: {
      heading: 'The shopping list',
      blurb: "This is where the shared list will live, ordered the way you two walk the shop.",
    },
    meals: {
      heading: 'This week’s meals',
      blurb: 'This is where the weekly planner will live, with ingredients that flow into the shopping list.',
    },
    calendar: {
      heading: 'The household calendar',
      blurb: 'This is where the shared calendar will live, which will also push to Google Calendar.',
    },
  },

  settings: {
    installTitle: 'Install Niu',
    installedBody: "You've already got it installed. Open it from your phone's home screen.",
    availableBody: 'Add Niu to your home screen so it opens like an app.',
    unavailableBody: "If you don't see a button, do it from the browser menu:",
    unavailableAction: 'Add to Home screen',
    installButton: 'Install',
    accountTitle: 'Account',
    accountBody: 'Google sign-in is coming in the next round.',
    householdTitle: 'Household',
    householdBody: 'Inviting your partner and sharing lists, further down the line.',
    version: 'Niu · skeleton (round 1)',
  },
} as const
