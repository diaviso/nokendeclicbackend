import sanitizeHtml from 'sanitize-html';

/**
 * Traitement du contenu riche d'une offre.
 *
 * Le balisage vient d'un éditeur du navigateur : il est écrit par l'auteur,
 * transite par une requête, et rien n'empêche de le remplacer par autre chose
 * en chemin. Il est donc assaini **côté serveur**, à l'enregistrement — un
 * nettoyage fait à l'affichage laisserait le poison en base, prêt à ressortir
 * partout où l'on oublierait de nettoyer.
 */

/**
 * Balises et attributs conservés.
 *
 * Liste blanche et non liste noire : une liste noire oublie toujours quelque
 * chose, et ce qui n'est pas prévu ici n'a rien à faire dans une annonce.
 */
const REGLES: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'hr',
    'h2', 'h3', 'h4',
    'strong', 'b', 'em', 'i', 'u', 's', 'code', 'mark', 'sup', 'sub',
    'ul', 'ol', 'li',
    'blockquote', 'pre',
    'a', 'img',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'span', 'div',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    // L'alignement de l'éditeur passe par un style en ligne : c'est le seul
    // qu'on accepte, et la propriété est vérifiée une à une.
    '*': ['style', 'class'],
    th: ['colspan', 'rowspan'],
    td: ['colspan', 'rowspan'],
  },
  allowedStyles: {
    '*': {
      'text-align': [/^(left|right|center|justify)$/],
    },
  },
  // `data:` est exclu : une image en base64 dans une annonce sert surtout à
  // faire passer un contenu que personne n'a vu.
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  transformTags: {
    // Un lien d'annonce mène ailleurs : il s'ouvre dans un onglet neuf, et
    // `noopener` empêche la page d'arrivée d'agir sur celle d'origine.
    a: sanitizeHtml.simpleTransform('a', {
      target: '_blank',
      rel: 'noopener noreferrer nofollow',
    }),
    // Les titres de premier niveau sont ramenés au deuxième : le `h1` de la
    // page est le titre de l'offre, en avoir deux brouille la structure du
    // document autant pour un lecteur d'écran que pour un moteur.
    h1: 'h2',
  },
  nonTextTags: ['style', 'script', 'textarea', 'option', 'noscript'],
};

/** Nettoie le balisage. Renvoie `null` si rien d'exploitable n'en sort. */
export function assainirHtml(html?: string | null): string | null {
  if (!html?.trim()) return null;
  const propre = sanitizeHtml(html, REGLES).trim();
  // Un éditeur vidé laisse « <p></p> » : ce n'est pas du contenu.
  return propre && propre.replace(/<[^>]*>/g, '').trim() ? propre : null;
}

/**
 * Texte brut tiré du balisage.
 *
 * Sert la recherche, l'aperçu de partage et l'assistant, qui ne savent que
 * faire de balises. Les blocs sont séparés par des sauts de ligne, sans quoi la
 * fin d'un paragraphe se collerait au début du suivant.
 */
export function htmlVersTexte(html?: string | null): string {
  if (!html) return '';
  const espace = html
    .replace(/<\/(p|div|li|h[1-6]|tr|blockquote)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n');
  return sanitizeHtml(espace, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/** Accroche tirée du texte, coupée sur un mot entier. */
export function extraireAccroche(texte: string, longueur = 200): string {
  const propre = texte.replace(/\s+/g, ' ').trim();
  if (propre.length <= longueur) return propre;
  const coupe = propre.slice(0, longueur);
  const espace = coupe.lastIndexOf(' ');
  return `${(espace > longueur * 0.6 ? coupe.slice(0, espace) : coupe).trim()}…`;
}

/**
 * Portion d'adresse lisible tirée du titre.
 *
 * Les diacritiques sont décomposées puis retirées : « Développeur » devient
 * « developpeur » et non « d-veloppeur ».
 */
export function fabriquerSlug(titre: string): string {
  return titre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
