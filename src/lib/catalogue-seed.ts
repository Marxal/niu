/*
 * The starting catalogue: the tiles you tap instead of typing.
 *
 * This is data, not logic. It lives in the app rather than only in SQL so the
 * seed can be regenerated, re-ordered or translated without a database
 * migration, and so the ordering below is reviewable in one place.
 *
 * Three fields per item:
 *
 *   name       what's shown on the tile.
 *   icon       a slug from src/lib/icons.ts. Omitted where no drawing fits, and
 *              the tile then shows the item's outlined initial instead — a real
 *              part of the design, not a gap. About 15 items sit there.
 *   suggested  rank in the "typical stuff" order shown before the app has
 *              learned anything. Omitted for all but ~20 items.
 *
 * Category order is the order they appear in the grid, and it is a hand-picked
 * guess at how a supermarket is walked — produce first, freezer and household
 * last. NIU.md §4.1 wants this order *learned* from the order things get ticked
 * off, per shop. That needs tick history to exist first, so this is the sensible
 * default it starts from and later gets replaced by.
 *
 * Names are English (confirmed), lowercase, singular unless the thing is
 * normally bought as a plural ("eggs"). Keeping that consistent matters because
 * the unique index in 0002 is on lower(trim(name)) — "Milk" and "milk" are the
 * same tile.
 */

import type { IconName } from './icons'

export interface SeedCategory {
  readonly name: string
  /** Icon slug for the category header row — must exist in icons.ts. */
  readonly icon: IconName
  readonly items: readonly SeedItem[]
}

export interface SeedItem {
  readonly name: string
  /** Slug from the icon set. Absent means "draw the initial instead". */
  readonly icon?: IconName
  /**
   * The emoji this item used to carry, kept for the "Colour" icon style.
   * Only ~37% of items have one — emoji coverage was always the weaker of the
   * two, which is why Colour mode falls back to the line icon before it falls
   * back to a letter.
   */
  readonly emoji?: string
  /** Position in the pre-learning suggested order. Absent means unranked. */
  readonly suggested?: number
}

export const CATALOGUE_SEED: readonly SeedCategory[] = [
  {
    name: 'Fruit & vegetables',
    icon: 'carrot',
    items: [
      { name: 'apples', icon: 'apple', emoji: '🍎', suggested: 14 },
      { name: 'bananas', icon: 'banana', emoji: '🍌', suggested: 4 },
      { name: 'oranges', icon: 'citrus', emoji: '🍊' },
      { name: 'lemons', icon: 'citrus', emoji: '🍋' },
      { name: 'limes', icon: 'citrus' },
      { name: 'strawberries', icon: 'strawberry', emoji: '🍓' },
      { name: 'raspberries', icon: 'strawberry' },
      { name: 'blueberries', icon: 'strawberry', emoji: '🫐' },
      { name: 'grapes', icon: 'grapes', emoji: '🍇' },
      { name: 'cherries', icon: 'strawberry', emoji: '🍒' },
      { name: 'melon', icon: 'melon', emoji: '🍈' },
      { name: 'watermelon', icon: 'melon', emoji: '🍉' },
      { name: 'peaches', icon: 'apple', emoji: '🍑' },
      { name: 'pears', icon: 'apple', emoji: '🍐' },
      { name: 'plums', icon: 'apple' },
      { name: 'apricots', icon: 'apple' },
      { name: 'figs', icon: 'apple' },
      { name: 'pineapple', icon: 'melon', emoji: '🍍' },
      { name: 'kiwi', icon: 'melon', emoji: '🥝' },
      { name: 'mango', icon: 'melon', emoji: '🥭' },
      { name: 'pomegranate', icon: 'apple' },
      { name: 'avocado', icon: 'melon', emoji: '🥑' },
      { name: 'tomatoes', icon: 'tomato', emoji: '🍅', suggested: 5 },
      { name: 'cherry tomatoes', icon: 'tomato', emoji: '🍅' },
      { name: 'potatoes', icon: 'potato', emoji: '🥔', suggested: 7 },
      { name: 'sweet potato', icon: 'potato', emoji: '🍠' },
      { name: 'onions', icon: 'onion', emoji: '🧅', suggested: 6 },
      { name: 'spring onions', icon: 'onion' },
      { name: 'garlic', icon: 'garlic', emoji: '🧄' },
      { name: 'carrots', icon: 'carrot', emoji: '🥕', suggested: 20 },
      { name: 'peppers', icon: 'pepper', emoji: '🫑' },
      { name: 'chillies', icon: 'pepper', emoji: '🌶️' },
      { name: 'courgette', icon: 'cucumber', emoji: '🥒' },
      { name: 'aubergine', icon: 'cucumber', emoji: '🍆' },
      { name: 'cucumber', icon: 'cucumber', emoji: '🥒' },
      { name: 'lettuce', icon: 'lettuce', emoji: '🥬', suggested: 19 },
      { name: 'rocket', icon: 'lettuce' },
      { name: 'spinach', icon: 'lettuce', emoji: '🥬' },
      { name: 'broccoli', icon: 'broccoli', emoji: '🥦' },
      { name: 'cauliflower', icon: 'broccoli' },
      { name: 'cabbage', icon: 'broccoli' },
      { name: 'brussels sprouts', icon: 'broccoli' },
      { name: 'asparagus', icon: 'lettuce' },
      { name: 'artichoke', icon: 'broccoli' },
      { name: 'fennel', icon: 'broccoli' },
      { name: 'mushrooms', icon: 'mushroom', emoji: '🍄' },
      { name: 'sweetcorn', icon: 'corn', emoji: '🌽' },
      { name: 'green beans', icon: 'peas' },
      { name: 'peas', icon: 'peas' },
      { name: 'leek', icon: 'onion' },
      { name: 'celery', icon: 'lettuce' },
      { name: 'radish', icon: 'cucumber' },
      { name: 'beetroot', icon: 'cucumber' },
      { name: 'pumpkin', icon: 'cucumber', emoji: '🎃' },
      { name: 'ginger', icon: 'cucumber' },
      { name: 'parsley', icon: 'herbs', emoji: '🌿' },
      { name: 'basil', icon: 'herbs', emoji: '🌿' },
      { name: 'coriander', icon: 'herbs', emoji: '🌿' },
      { name: 'mint', icon: 'herbs', emoji: '🌿' },
      { name: 'rosemary', icon: 'herbs', emoji: '🌿' },
      { name: 'salad bag', icon: 'lettuce' },
    ],
  },
  {
    name: 'Bakery',
    icon: 'bread',
    items: [
      { name: 'bread', icon: 'bread', emoji: '🍞', suggested: 2 },
      { name: 'baguette', icon: 'baguette', emoji: '🥖' },
      { name: 'sliced bread', icon: 'bread' },
      { name: 'wholemeal bread', icon: 'bread' },
      { name: 'sourdough', icon: 'bread' },
      { name: 'bread rolls', icon: 'bread' },
      { name: 'ciabatta', icon: 'bread' },
      { name: 'focaccia', icon: 'bread' },
      { name: 'brioche', icon: 'bread' },
      { name: 'croissants', icon: 'croissant', emoji: '🥐' },
      { name: 'bagels', icon: 'cake', emoji: '🥯' },
      { name: 'pitta bread', icon: 'bread' },
      { name: 'naan', icon: 'bread' },
      { name: 'tortillas', icon: 'bread', emoji: '🌯' },
      { name: 'pastries', icon: 'croissant', emoji: '🥧' },
      { name: 'cake', icon: 'cake', emoji: '🍰' },
      { name: 'muffins', icon: 'cake', emoji: '🧁' },
      { name: 'doughnuts', icon: 'croissant', emoji: '🍩' },
      { name: 'scones', icon: 'bread' },
      { name: 'biscuits', icon: 'cookie', emoji: '🍪' },
    ],
  },
  {
    name: 'Dairy & eggs',
    icon: 'milk',
    items: [
      { name: 'milk', icon: 'milk', emoji: '🥛', suggested: 1 },
      { name: 'semi-skimmed milk', icon: 'milk' },
      { name: 'oat milk', icon: 'milk' },
      { name: 'almond milk', icon: 'milk' },
      { name: 'soy milk', icon: 'milk' },
      { name: 'eggs', icon: 'egg', emoji: '🥚', suggested: 3 },
      { name: 'butter', icon: 'butter', emoji: '🧈', suggested: 12 },
      { name: 'margarine', icon: 'butter' },
      { name: 'cheese', icon: 'cheese', emoji: '🧀', suggested: 11 },
      { name: 'cheddar', icon: 'cheese', emoji: '🧀' },
      { name: 'grated cheese', icon: 'cheese' },
      { name: 'goat cheese', icon: 'cheese' },
      { name: 'blue cheese', icon: 'cheese' },
      { name: 'brie', icon: 'cheese' },
      { name: 'manchego', icon: 'cheese' },
      { name: 'mozzarella', icon: 'cheese' },
      { name: 'parmesan', icon: 'cheese' },
      { name: 'feta', icon: 'cheese' },
      { name: 'ricotta', icon: 'cheese' },
      { name: 'mascarpone', icon: 'cheese' },
      { name: 'cream cheese', icon: 'cheese' },
      { name: 'cottage cheese', icon: 'cheese' },
      { name: 'yoghurt', icon: 'yoghurt', suggested: 13 },
      { name: 'greek yoghurt', icon: 'yoghurt' },
      { name: 'kefir', icon: 'yoghurt' },
      { name: 'cream', icon: 'yoghurt' },
      { name: 'sour cream', icon: 'yoghurt' },
      { name: 'creme fraiche', icon: 'yoghurt' },
      { name: 'custard', icon: 'yoghurt' },
      { name: 'condensed milk', icon: 'milk' },
    ],
  },
  {
    name: 'Meat & fish',
    icon: 'meat',
    items: [
      { name: 'chicken breast', icon: 'chicken', emoji: '🍗', suggested: 8 },
      { name: 'chicken thighs', icon: 'chicken', emoji: '🍗' },
      { name: 'chicken wings', icon: 'chicken', emoji: '🍗' },
      { name: 'whole chicken', icon: 'chicken', emoji: '🍗' },
      { name: 'turkey', icon: 'chicken' },
      { name: 'minced beef', icon: 'meat' },
      { name: 'beef steak', icon: 'meat', emoji: '🥩' },
      { name: 'beef stewing', icon: 'meat' },
      { name: 'burger patties', icon: 'meat', emoji: '🍔' },
      { name: 'meatballs', icon: 'meat' },
      { name: 'pork chops', icon: 'meat', emoji: '🥩' },
      { name: 'pork belly', icon: 'meat' },
      { name: 'ribs', icon: 'meat' },
      { name: 'lamb', icon: 'meat' },
      { name: 'veal', icon: 'meat' },
      { name: 'duck', icon: 'chicken' },
      { name: 'rabbit', icon: 'meat' },
      { name: 'sausages', icon: 'sausage', emoji: '🌭' },
      { name: 'bacon', icon: 'sausage', emoji: '🥓' },
      { name: 'ham', icon: 'sausage' },
      { name: 'chorizo', icon: 'sausage' },
      { name: 'salami', icon: 'sausage' },
      { name: 'pate', icon: 'sausage' },
      { name: 'black pudding', icon: 'sausage' },
      { name: 'salmon', icon: 'fish', emoji: '🐟' },
      { name: 'smoked salmon', icon: 'fish', emoji: '🐟' },
      { name: 'white fish', icon: 'fish', emoji: '🐟' },
      { name: 'cod', icon: 'fish' },
      { name: 'hake', icon: 'fish' },
      { name: 'sea bass', icon: 'fish' },
      { name: 'tuna steak', icon: 'meat', emoji: '🐟' },
      { name: 'sardines', icon: 'fish', emoji: '🐟' },
      { name: 'anchovies', icon: 'fish' },
      { name: 'prawns', icon: 'shrimp', emoji: '🦐' },
      { name: 'mussels', icon: 'shrimp', emoji: '🦪' },
      { name: 'clams', icon: 'shrimp' },
      { name: 'squid', icon: 'shrimp', emoji: '🦑' },
      { name: 'octopus', icon: 'shrimp', emoji: '🐙' },
      { name: 'crab', icon: 'shrimp', emoji: '🦀' },
    ],
  },
  {
    name: 'Pantry',
    icon: 'can',
    items: [
      { name: 'pasta', icon: 'pasta', emoji: '🍝', suggested: 9 },
      { name: 'spaghetti', icon: 'pasta', emoji: '🍝' },
      { name: 'lasagne sheets', icon: 'pasta' },
      { name: 'gnocchi', icon: 'pasta' },
      { name: 'rice', icon: 'rice', emoji: '🍚', suggested: 10 },
      { name: 'risotto rice', icon: 'rice' },
      { name: 'noodles', icon: 'pasta', emoji: '🍜' },
      { name: 'rice noodles', icon: 'pasta' },
      { name: 'couscous', icon: 'pasta' },
      { name: 'quinoa', icon: 'rice' },
      { name: 'polenta', icon: 'rice' },
      { name: 'bulgur', icon: 'rice' },
      { name: 'lentils', icon: 'can' },
      { name: 'chickpeas', icon: 'can' },
      { name: 'kidney beans', icon: 'can' },
      { name: 'white beans', icon: 'can' },
      { name: 'tinned tomatoes', icon: 'tomato', emoji: '🥫', suggested: 21 },
      { name: 'passata', icon: 'can' },
      { name: 'tomato sauce', icon: 'sauce', emoji: '🥫' },
      { name: 'tomato puree', icon: 'tube' },
      { name: 'tinned tuna', icon: 'fish', emoji: '🥫' },
      { name: 'tinned sweetcorn', icon: 'can', emoji: '🥫' },
      { name: 'coconut milk', icon: 'milk' },
      { name: 'olive oil', icon: 'oil', emoji: '🫒', suggested: 15 },
      { name: 'sunflower oil', icon: 'oil' },
      { name: 'sesame oil', icon: 'oil' },
      { name: 'vinegar', icon: 'oil' },
      { name: 'balsamic vinegar', icon: 'oil' },
      { name: 'salt', icon: 'salt', emoji: '🧂' },
      { name: 'pepper', icon: 'salt' },
      { name: 'sugar', icon: 'salt' },
      { name: 'brown sugar', icon: 'salt' },
      { name: 'icing sugar', icon: 'salt' },
      { name: 'flour', icon: 'salt' },
      { name: 'cornflour', icon: 'corn' },
      { name: 'baking powder', icon: 'salt' },
      { name: 'yeast', icon: 'salt' },
      { name: 'vanilla', icon: 'spice' },
      { name: 'cocoa powder', icon: 'spice' },
      { name: 'chocolate chips', icon: 'juice' },
      { name: 'honey', icon: 'honey', emoji: '🍯' },
      { name: 'jam', icon: 'honey' },
      { name: 'marmalade', icon: 'honey' },
      { name: 'peanut butter', icon: 'honey', emoji: '🥜' },
      { name: 'chocolate spread', icon: 'honey' },
      { name: 'tahini', icon: 'honey' },
      { name: 'cereal', icon: 'cereal', emoji: '🥣' },
      { name: 'porridge oats', icon: 'cereal', emoji: '🥣' },
      { name: 'muesli', icon: 'cereal' },
      { name: 'granola', icon: 'cereal' },
      { name: 'stock cubes', icon: 'sauce' },
      { name: 'soy sauce', icon: 'sauce' },
      { name: 'fish sauce', icon: 'fish' },
      { name: 'worcestershire sauce', icon: 'sauce' },
      { name: 'hot sauce', icon: 'sauce' },
      { name: 'bbq sauce', icon: 'sauce' },
      { name: 'mustard', icon: 'sauce' },
      { name: 'mayonnaise', icon: 'sauce' },
      { name: 'ketchup', icon: 'sauce' },
      { name: 'pesto', icon: 'jar' },
      { name: 'curry paste', icon: 'sauce' },
      { name: 'harissa', icon: 'sauce' },
      { name: 'olives', icon: 'jar', emoji: '🫒' },
      { name: 'pickles', icon: 'jar' },
      { name: 'capers', icon: 'jar' },
      { name: 'nuts', icon: 'nuts', emoji: '🥜' },
      { name: 'almonds', icon: 'nuts' },
      { name: 'walnuts', icon: 'nuts' },
      { name: 'cashews', icon: 'nuts' },
      { name: 'pistachios', icon: 'nuts' },
      { name: 'raisins', icon: 'grapes' },
      { name: 'dates', icon: 'nuts' },
      { name: 'dried apricots', icon: 'seeds' },
      { name: 'chia seeds', icon: 'nuts' },
      { name: 'sunflower seeds', icon: 'nuts' },
      { name: 'pumpkin seeds', icon: 'cucumber' },
      { name: 'spices', icon: 'spice' },
      { name: 'paprika', icon: 'spice' },
      { name: 'oregano', icon: 'herbs' },
      { name: 'thyme', icon: 'herbs' },
      { name: 'bay leaves', icon: 'herbs' },
      { name: 'cinnamon', icon: 'spice' },
      { name: 'nutmeg', icon: 'spice' },
      { name: 'cumin', icon: 'spice' },
      { name: 'turmeric', icon: 'spice' },
      { name: 'curry powder', icon: 'spice' },
      { name: 'chilli flakes', icon: 'spice' },
      { name: 'garlic powder', icon: 'spice' },
      { name: 'breadcrumbs', icon: 'salt' },
    ],
  },
  {
    name: 'Frozen',
    icon: 'frozen',
    items: [
      { name: 'frozen peas', icon: 'frozen' },
      { name: 'frozen spinach', icon: 'lettuce' },
      { name: 'frozen vegetables', icon: 'frozen' },
      { name: 'frozen berries', icon: 'frozen' },
      { name: 'frozen chips', icon: 'frozen', emoji: '🍟' },
      { name: 'frozen pizza', icon: 'frozen', emoji: '🍕' },
      { name: 'frozen fish', icon: 'fish' },
      { name: 'frozen prawns', icon: 'shrimp' },
      { name: 'frozen burgers', icon: 'frozen' },
      { name: 'chicken nuggets', icon: 'chicken' },
      { name: 'frozen pastry', icon: 'frozen' },
      { name: 'frozen bread', icon: 'frozen' },
      { name: 'ice cream', icon: 'iceCream', emoji: '🍨' },
      { name: 'sorbet', icon: 'iceCream' },
      { name: 'ice cubes', icon: 'iceCream', emoji: '🧊' },
    ],
  },
  {
    name: 'Drinks',
    icon: 'water',
    items: [
      { name: 'water', icon: 'water', emoji: '💧', suggested: 22 },
      { name: 'sparkling water', icon: 'water' },
      { name: 'coconut water', icon: 'water' },
      { name: 'orange juice', icon: 'juice', emoji: '🧃' },
      { name: 'apple juice', icon: 'juice', emoji: '🧃' },
      { name: 'lemonade', icon: 'juice' },
      { name: 'cola', icon: 'juice' },
      { name: 'soft drinks', icon: 'juice', emoji: '🥤' },
      { name: 'tonic water', icon: 'juice' },
      { name: 'iced tea', icon: 'tea' },
      { name: 'energy drink', icon: 'juice' },
      { name: 'kombucha', icon: 'beer' },
      { name: 'coffee', icon: 'coffee', emoji: '☕', suggested: 16 },
      { name: 'ground coffee', icon: 'coffee', emoji: '☕' },
      { name: 'coffee capsules', icon: 'coffee', emoji: '☕' },
      { name: 'tea', icon: 'tea', emoji: '🍵' },
      { name: 'herbal tea', icon: 'tea', emoji: '🍵' },
      { name: 'hot chocolate', icon: 'coffee' },
      { name: 'red wine', icon: 'wine', emoji: '🍷' },
      { name: 'white wine', icon: 'wine', emoji: '🍷' },
      { name: 'rose wine', icon: 'wine', emoji: '🍷' },
      { name: 'cava', icon: 'wine', emoji: '🍾' },
      { name: 'beer', icon: 'beer', emoji: '🍺' },
      { name: 'cider', icon: 'beer' },
      { name: 'vermouth', icon: 'wine' },
      { name: 'gin', icon: 'wine' },
      { name: 'whisky', icon: 'wine', emoji: '🥃' },
      { name: 'rum', icon: 'wine' },
      { name: 'vodka', icon: 'wine' },
    ],
  },
  {
    name: 'Snacks',
    icon: 'chocolate',
    items: [
      { name: 'crisps', icon: 'crisps' },
      { name: 'tortilla chips', icon: 'crisps' },
      { name: 'nachos', icon: 'crisps' },
      { name: 'pretzels', icon: 'crisps', emoji: '🥨' },
      { name: 'popcorn', icon: 'crisps', emoji: '🍿' },
      { name: 'crackers', icon: 'cookie' },
      { name: 'breadsticks', icon: 'baguette' },
      { name: 'rice cakes', icon: 'cookie' },
      { name: 'chocolate', icon: 'juice', emoji: '🍫' },
      { name: 'sweets', icon: 'chocolate', emoji: '🍬' },
      { name: 'chewing gum', icon: 'chocolate' },
      { name: 'marshmallows', icon: 'chocolate' },
      { name: 'cereal bars', icon: 'cereal' },
      { name: 'dried fruit', icon: 'crisps' },
      { name: 'salsa', icon: 'jar' },
      { name: 'guacamole', icon: 'jar' },
      { name: 'hummus', icon: 'jar' },
    ],
  },
  {
    name: 'Household',
    icon: 'detergent',
    items: [
      { name: 'toilet paper', icon: 'toiletPaper', emoji: '🧻', suggested: 17 },
      { name: 'kitchen roll', icon: 'toiletPaper', emoji: '🧻' },
      { name: 'tissues', icon: 'toiletPaper' },
      { name: 'bin bags', icon: 'binBag', emoji: '🗑️' },
      { name: 'food bags', icon: 'binBag' },
      { name: 'freezer bags', icon: 'binBag' },
      { name: 'cling film', icon: 'foil' },
      { name: 'aluminium foil', icon: 'foil' },
      { name: 'baking paper', icon: 'foil' },
      { name: 'washing up liquid', icon: 'detergent', emoji: '🧽', suggested: 18 },
      { name: 'dishwasher tablets', icon: 'detergent' },
      { name: 'dish cloths', icon: 'sponge' },
      { name: 'sponges', icon: 'sponge', emoji: '🧽' },
      { name: 'scourers', icon: 'sponge' },
      { name: 'rubber gloves', icon: 'sponge', emoji: '🧤' },
      { name: 'laundry detergent', icon: 'detergent', emoji: '🧺' },
      { name: 'fabric softener', icon: 'detergent' },
      { name: 'stain remover', icon: 'detergent' },
      { name: 'surface cleaner', icon: 'spray', emoji: '🧴' },
      { name: 'bleach', icon: 'aerosol' },
      { name: 'toilet cleaner', icon: 'aerosol' },
      { name: 'oven cleaner', icon: 'aerosol' },
      { name: 'window cleaner', icon: 'spray' },
      { name: 'air freshener', icon: 'spray' },
      { name: 'insect spray', icon: 'spray' },
      { name: 'batteries', icon: 'battery', emoji: '🔋' },
      { name: 'light bulbs', icon: 'bulb', emoji: '💡' },
      { name: 'candles', icon: 'candle', emoji: '🕯️' },
      { name: 'matches', icon: 'candle' },
      { name: 'tape', icon: 'tube' },
    ],
  },
  {
    name: 'Personal care',
    icon: 'soap',
    items: [
      { name: 'shampoo', icon: 'shampoo', emoji: '🧴' },
      { name: 'conditioner', icon: 'shampoo', emoji: '🧴' },
      { name: 'shower gel', icon: 'soap', emoji: '🧴' },
      { name: 'soap', icon: 'soap', emoji: '🧼' },
      { name: 'hand soap', icon: 'soap', emoji: '🧼' },
      { name: 'hand sanitiser', icon: 'soap' },
      { name: 'hand cream', icon: 'soap' },
      { name: 'moisturiser', icon: 'soap' },
      { name: 'lip balm', icon: 'soap' },
      { name: 'sun cream', icon: 'soap', emoji: '🧴' },
      { name: 'deodorant', icon: 'deodorant' },
      { name: 'toothpaste', icon: 'toothpaste', emoji: '🪥' },
      { name: 'toothbrush', icon: 'toothbrush', emoji: '🪥' },
      { name: 'mouthwash', icon: 'toothpaste' },
      { name: 'dental floss', icon: 'toothpaste' },
      { name: 'razors', icon: 'toothbrush', emoji: '🪒' },
      { name: 'shaving foam' },
      { name: 'hairbrush', icon: 'toothbrush' },
      { name: 'hair gel' },
      { name: 'cotton buds', icon: 'sponge' },
      { name: 'cotton pads', icon: 'sponge' },
      { name: 'wet wipes', icon: 'sponge' },
      { name: 'nail clippers', icon: 'toothbrush' },
      { name: 'sanitary pads', icon: 'pills' },
      { name: 'tampons', icon: 'pills' },
      { name: 'plasters', icon: 'pills', emoji: '🩹' },
      { name: 'antiseptic cream', icon: 'pills' },
      { name: 'paracetamol', icon: 'pills', emoji: '💊' },
      { name: 'ibuprofen', icon: 'pills', emoji: '💊' },
      { name: 'throat lozenges', icon: 'pills' },
      { name: 'vitamins', icon: 'pills', emoji: '💊' },
    ],
  },
]

/** Every seed item flattened, with its category and grid position attached. */
export function flattenSeed(): {
  name: string
  category: string
  icon: string | null
  emoji: string | null
  sortOrder: number
  suggestedRank: number | null
}[] {
  const rows: {
    name: string
    category: string
    icon: string | null
    emoji: string | null
    sortOrder: number
    suggestedRank: number | null
  }[] = []

  CATALOGUE_SEED.forEach((category, categoryIndex) => {
    category.items.forEach((item, itemIndex) => {
      rows.push({
        name: item.name,
        category: category.name,
        icon: item.icon ?? null,
        emoji: item.emoji ?? null,
        // Category first, then position within it. The 1000 gap leaves room to
        // insert items into a category later without renumbering everything.
        sortOrder: categoryIndex * 1000 + itemIndex,
        suggestedRank: item.suggested ?? null,
      })
    })
  })

  return rows
}

/** Icon slug for a category header, by category name. */
export function categoryIcon(categoryName: string): string | null {
  return CATALOGUE_SEED.find((c) => c.name === categoryName)?.icon ?? null
}
