// Blocks posts containing slurs or strong profanity before they are saved
// (App Store guideline 1.2: "a method for filtering objectionable material from
// being posted"). Whole-word matching, so ordinary words that merely contain one
// of these ("Scunthorpe", "assess") still pass. Reporting and blocking handle
// whatever a word list cannot.
const BLOCKED = [
  // strong profanity
  'fuck', 'fucking', 'fucker', 'motherfucker', 'shit', 'shitty', 'bullshit', 'cunt', 'cocksucker',
  'asshole', 'bitch', 'bastard', 'dickhead', 'twat', 'wanker', 'whore', 'slut',
  // slurs
  'nigger', 'nigga', 'faggot', 'fag', 'retard', 'retarded', 'spic', 'chink', 'kike', 'wetback',
  'tranny', 'dyke', 'paki', 'gook', 'coon',
];

// Undo the common disguises: l33t digits, repeated letters, separators.
function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[0@]/g, 'o').replace(/[1!|]/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a')
    .replace(/[5$]/g, 's').replace(/7/g, 't')
    .replace(/(.)\1{2,}/g, '$1$1');
}

const PATTERN = new RegExp(`(^|[^a-z])(${BLOCKED.join('|')})(s|es|ed|ing)?(?=[^a-z]|$)`);

export function containsObjectionable(text: string): boolean {
  const n = normalise(text);
  // Also check with separators removed inside words ("f.u.c.k", "s h i t").
  const squashed = n.replace(/(\b\w)[\s.\-_*]+(?=\w\b)/g, '$1');
  // And with every run of a letter collapsed to one ("shiiiit").
  const collapsed = n.replace(/(.)\1+/g, '$1');
  return PATTERN.test(n) || PATTERN.test(squashed) || PATTERN.test(collapsed);
}

export const OBJECTIONABLE_MESSAGE =
  "Let's keep it friendly — this contains language that isn't allowed on Chrp. Please edit it and try again.";
