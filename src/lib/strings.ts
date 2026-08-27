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
      heading: 'Dishes',
      blurb: 'The things you cook, ready to drop onto the shopping list — and, next round, onto a week.',
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
    celebrate: 'That’s the lot. Go home.',
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
    // The "you usually need…" strip (NIU.md §5). Never auto-adds.
    dueTitle: 'You usually need…',
    dueHint: 'Going by how often you buy these. Tap to add.',
    searchResults: 'Matches',
    allCategories: 'Everything else',
    // Long-press menu on a catalogue tile
    tileMenuTitle: 'What would you like to do?',
    changeIcon: 'Change icon',
    pickIconTitle: 'Pick an icon',
    resetIcon: 'Use the default icon',
    iconSearch: 'Search pictures…',
    iconNoResults: 'No picture matches that. Try the thing it is made of.',
    addToDish: 'Add to a dish',
    // Removing a tile from the picker for good
    hideTitle: 'Remove for good?',
    hideBody: 'It disappears from your catalogue. It stays on the list if it is already there.',
    hideConfirm: 'Remove',
    hideCancel: 'Keep it',
    // Item detail
    quantity: 'How many',
    fewer: 'One fewer',
    more: 'One more',
    note: 'Note',
    notePlaceholder: 'e.g. the big one, or a brand',
    urgent: 'Urgent',
    ifConvenient: 'If convenient',
    remove: 'Remove from list',
    done: 'Done',
    // Item badges
    newTag: 'NEW',
    // View toggle
    viewGrid: 'Grid',
    viewList: 'List',
    sortLabel: 'List order',
    // Errors
    loadFailed: "Couldn't load the list just now. Pull down to try again.",
    addFailed: "Couldn't add that just now. Try again in a moment.",
    updateFailed: "Couldn't save that just now. Try again in a moment.",
  },

  dishes: {
    // The library, on the Meals tab
    title: 'Dishes',
    hint: 'A dish is a name and, if you want, the things it is made of. Tap one in the shopping list to add all of them at once.',
    emptyTitle: 'No dishes yet',
    emptyBlurb: 'Add the things you actually cook. Even just a name is useful — the ingredients can come later.',
    new: 'New dish',
    edit: 'Edit dish',
    // The category the dishes appear as, in the shopping catalogue
    categoryName: 'Dishes',
    // The editor
    nameLabel: 'Name',
    namePlaceholder: 'Lasagne, tacos, that rice thing…',
    iconLabel: 'Picture',
    // The meal-part tags. The three a household starts with — Protein, Carbs,
    // Vegetables — are seeded by 0009_dish_tags.sql rather than named here,
    // because from the first load they are the household's own rows to rename,
    // recolour or throw away. Only the chrome around them lives in this file.
    tagsTitle: 'Part of the meal',
    tagsAdd: 'Add',
    tagNew: 'New part of a meal',
    tagEdit: 'Edit this part',
    tagName: 'Name',
    tagNamePlaceholder: 'Pudding, side, snack…',
    tagColour: 'Colour',
    tagColourNamed: (colour: string) => `Colour: ${colour}`,
    tagNone: 'None of them yet. Tap Add to write one.',
    tagDeleteTitle: 'Delete this part?',
    tagDeleteBody: 'It goes from every dish that carries it. The dishes stay.',
    tagDuplicate: 'There is already a part with that name.',
    // The chips a list item wears when a dish put it there
    forDish: (dish: string) => `For ${dish}`,
    cookTitle: 'Cooking',
    cookNone: 'No cook',
    cookFast: 'Quick',
    cookSlow: 'Slow',
    ingredientsTitle: 'What it needs',
    ingredientsHint: 'Optional. A dish with no ingredients is still a dish you can plan.',
    ingredientsEmpty: 'Nothing yet.',
    ingredientSearch: 'Search the catalogue…',
    ingredientSuggestions: 'Often bought',
    ingredientNone: 'Nothing matches that.',
    removeIngredient: 'Take this out',
    save: 'Save',
    create: 'Add it',
    cancel: 'Cancel',
    delete: 'Delete dish',
    deleteTitle: 'Delete this dish?',
    deleteBody: 'It goes from the library and from the shopping catalogue. Nothing on the list changes.',
    deleteConfirm: 'Delete',
    deleteCancel: 'Keep it',
    // How many things a dish is made of, on its tile and in the library
    itemCount: (n: number) => (n === 1 ? '1 thing' : `${n} things`),
    noItems: 'just a name',
    // What happens after tapping a dish in the shopping list
    flashAdded: (n: number) => (n === 1 ? 'One thing added.' : `${n} things added.`),
    flashAllThere: 'It is all on the list already.',
    flashNoItems: 'No ingredients yet — add some under Meals.',
    // Putting a shopping tile into a dish, from the long-press menu
    pickTitle: 'Which dish?',
    pickHint: 'It gets added to whichever you pick. Nothing on the list changes.',
    pickEmpty: 'No dishes yet. Write one and this goes straight into it.',
    addedTo: (dish: string) => `Added to ${dish}.`,
    // Errors
    loadFailed: "Couldn't load your dishes just now. Pull down to try again.",
    saveFailed: "Couldn't save that just now. Try again in a moment.",
    addFailed: "Couldn't add those just now. Try again in a moment.",
    duplicateName: 'There is already a dish with that name.',
  },

  plan: {
    // The planner, on the Meals tab
    title: 'Plan',
    dishesLink: 'Dishes',
    dishesBack: 'Back to the plan',
    viewDay: 'Days',
    viewWeek: 'Week',
    previousWeek: 'The week before',
    nextWeek: 'The week after',
    thisWeek: 'Back to this week',
    // A meal with nothing in it
    addTo: (meal: string) => `Add to ${meal.toLowerCase()}`,
    empty: 'Nothing yet',
    mealBreakfast: 'Breakfast',
    mealLunch: 'Lunch',
    mealDinner: 'Dinner',
    // What a card can be
    leftovers: 'Leftovers',
    leftoversOf: (dish: string) => `${dish}, again`,
    out: 'Eating out',
    again: 'Again',
    againTitle: 'The same thing as the night before — no extra shopping',
    // Picking something to plan
    pickTitle: 'What are we having?',
    pickHint: (meal: string, day: string) => `${meal} · ${day}`,
    pickDishes: 'Dishes',
    pickItems: 'Or just a thing',
    pickMarkers: 'Or neither',
    pickSearch: 'Search dishes and the catalogue…',
    pickNone: 'Nothing matches that.',
    pickEmptyLibrary: 'No dishes yet. You can plan a plain thing instead, or write a dish first.',
    newDish: 'New dish',
    // The coverage note beside a dish while picking
    haveAll: 'you have it all',
    haveSome: (have: number, total: number) => `${have} of ${total}`,
    haveFrom: 'on your list or just bought',
    // What can we make
    makeableTitle: 'What can we make?',
    makeableHint:
      'Dishes you have most of — from what is on the list now and what you bought in the last few days.',
    makeableNone:
      'Nothing yet. Put a few things on the shopping list, or finish a shop, and this fills up.',
    makeableMissing: (n: number) => (n === 1 ? 'needs 1 more thing' : `needs ${n} more things`),
    makeablePlan: 'Plan it',
    makeablePlanned: 'Planned',
    // The entry sheet
    entryTitle: 'This meal',
    entryMarkLeftovers: 'Mark as leftovers',
    entryMarkCooked: 'Mark as cooked fresh',
    entryShopFor: 'Add what it needs to the list',
    entryOpenDish: 'Edit this dish',
    entryNote: 'Note',
    entryNotePlaceholder: "At Mum's, the good sauce…",
    entryRemove: 'Take it off the plan',
    entryMove: 'Hold a card to drag it to another day.',
    // Shopping for the plan
    shopWeek: 'Shop for this week',
    shopDay: 'Shop for this day',
    shopTitle: 'Shop for the plan',
    shopRange: (from: string, to: string) => `${from} – ${to}`,
    shopNothingPlanned: 'Nothing is planned for these days yet.',
    shopNothingNeeded: 'Everything the plan needs is already on the list.',
    shopSilentOnly:
      'Nothing to buy for these days — it is all leftovers, eating out, or dishes with no ingredients yet.',
    shopAlready: (n: number) => (n === 1 ? '1 already on the list' : `${n} already on the list`),
    shopAdd: (n: number) => (n === 1 ? 'Add 1 thing' : `Add ${n} things`),
    shopAdded: (n: number) => (n === 1 ? 'One thing added.' : `${n} things added.`),
    shopAddedNone: 'It was all on the list already.',
    shopFor: (dishes: string) => `for ${dishes}`,
    shopForNobody: 'planned on its own',
    // Errors
    loadFailed: "Couldn't load the plan just now. Pull down to try again.",
    saveFailed: "Couldn't save that just now. Try again in a moment.",
    shopFailed: "Couldn't add those to the list just now. Try again in a moment.",
  },

  shops: {
    title: 'Shops',
    hint: 'Each shop learns its own order as you tick things off. Pick the one you’re in.',
    whichShop: 'Which shop',
    main: 'Main',
    makeMain: 'Make it the main one',
    addPlaceholder: 'Another shop’s name',
    add: 'Add',
    remove: 'Remove',
    removeTitle: 'Remove this shop?',
    removeBody: 'The order it learned goes with it. Nothing on the list changes.',
    removeCancel: 'Keep it',
    lastOne: 'There’s always one shop. Add another before removing this one.',
    loadFailed: "Couldn't load your shops just now.",
    addFailed: "Couldn't add that shop just now. It may already exist.",
    updateFailed: "Couldn't save that just now. Try again in a moment.",
  },

  prefs: {
    sortTitle: 'List order',
    sortShopOrder: 'Shop order',
    sortRecent: 'Recently added',
    sortCategory: 'By category',
    sortMostBought: 'Most bought',
    sortHint:
      'Shop order learns itself: every time you finish a shop, Niu remembers roughly where in it each thing was picked up.',
    iconsTitle: 'Icons',
    iconsLine: 'Lines',
    iconsEmoji: 'Emoji',
    iconsInked: 'Inked',
    iconsHint:
      'Emoji uses your phone’s own. Inked is a drawn set that looks the same on every phone. Both fall back to a line icon where an item has no picture.',
    iconsCredit: 'Inked icons by OpenMoji — CC BY-SA 4.0',
    viewTitle: 'List view',
    viewGrid4: 'Grid of 4',
    viewGrid3: 'Grid of 3',
    viewList: 'List',
    // The one setting on this screen that isn't per-device — see below.
    mealsTitle: 'Meals in a day',
    mealsHint:
      'Which meals the planner gives each day. This one is shared: it changes on both phones, because you both look at the same plan.',
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
    version: 'Niu · round 9',
  },
} as const
