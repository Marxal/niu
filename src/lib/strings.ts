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

  auth: {
    tagline: 'The shopping, the meals and the calendar — in one place, for the two of you.',
    googleButton: 'Continue with Google',
    signingIn: 'Taking you to Google…',
    signInFailed: "Couldn't reach Google just now. Check your connection and try again.",
    signOutFailed: "Couldn't sign out just now. Try again in a moment.",
    signOut: 'Sign out',
    privacy: 'Niu only asks Google for your name and email address.',
  },

  household: {
    title: 'Household',
    loading: 'Loading…',
    loadFailed: "Couldn't load your household just now. Pull down to try again.",
    defaultName: 'Our home',
  },

  shopping: {
    // Empty states
    emptyTitle: 'Nothing on the list',
    emptyBlurb: 'Tap something below, or type what you need.',
    // The two sections of the list
    toBuy: 'To buy',
    inTrolley: 'In the trolley',
    clearTrolley: 'Clear',
    shoppingDone: 'Shopping done!',
    shoppingDoneHint: 'Empties the trolley and starts a fresh list.',
    trolleyNote: 'Tap anything here to put it back on the list.',
    // Picker
    searchPlaceholder: 'I need…',
    addNewWord: 'Add',
    alreadyOnList: 'Already on the list',
    ourWordsCategory: 'Our own words',
    noResults: 'Nothing matches. Tap Add to create it.',
    close: 'Close',
    suggested: 'Suggested',
    recentlyUsed: 'Often bought',
    searchResults: 'Matches',
    allCategories: 'Everything else',
    // Long-press menu on a catalogue tile
    tileMenuTitle: 'What would you like to do?',
    changeIcon: 'Change icon',
    pickIconTitle: 'Pick an icon',
    resetIcon: 'Use the default icon',
    // Removing a tile from the picker for good
    hideTitle: 'Remove for good?',
    hideBody: 'It disappears from your catalogue. It stays on the list if it is already there.',
    hideConfirm: 'Remove',
    hideCancel: 'Keep it',
    // Item detail
    quantity: 'Quantity',
    unit: 'Unit',
    note: 'Note',
    notePlaceholder: 'e.g. the big one, or a brand',
    urgent: 'Urgent',
    remove: 'Remove from list',
    done: 'Done',
    // Item badges
    newTag: 'NEW',
    // View toggle
    viewGrid: 'Grid',
    viewList: 'List',
    sortShopOrder: 'Shop order',
    sortRecent: 'Recently added',
    sortCategory: 'By category',
    sortLabel: 'Sort',
    // Errors
    loadFailed: "Couldn't load the list just now. Pull down to try again.",
    addFailed: "Couldn't add that just now. Try again in a moment.",
    updateFailed: "Couldn't save that just now. Try again in a moment.",
  },

  prefs: {
    iconsTitle: 'Icons',
    iconsLine: 'Lines',
    iconsColour: 'Colour',
    iconsHint: 'Colour uses your phone’s emoji where an item has one, and a line icon everywhere else.',
    viewTitle: 'List view',
    viewGrid4: 'Grid of 4',
    viewGrid3: 'Grid of 3',
    viewList: 'List',
  },

  theme: {
    title: 'Appearance',
    system: 'Match phone',
    light: 'Light',
    dark: 'Dark',
  },

  settings: {
    installTitle: 'Install Niu',
    installedBody: "You've already got it installed. Open it from your phone's home screen.",
    availableBody: 'Add Niu to your home screen so it opens like an app.',
    unavailableBody: "If you don't see a button, do it from the browser menu:",
    unavailableAction: 'Add to Home screen',
    installButton: 'Install',
    accountTitle: 'Account',
    signedInAs: 'Signed in as',
    householdTitle: 'Household',
    householdBody: 'Inviting your partner and sharing lists, further down the line.',
    notConnectedTitle: 'Not connected yet',
    notConnectedBody:
      'Niu has no backend wired up in this build, so nothing is saved. Sign-in appears once Supabase is configured.',
    version: 'Niu · round 5',
  },
} as const
