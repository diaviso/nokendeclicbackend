/**
 * Version en vigueur des conditions générales d'utilisation.
 *
 * Le numéro est incrémenté **uniquement** lorsque le texte change sur le fond.
 * Chaque compte conserve la version qu'il a acceptée : à la publication d'une
 * nouvelle version, tous les comptes se retrouvent en décalage et leur accord
 * est redemandé. Une correction de ponctuation ne doit donc pas la faire
 * bouger, sous peine d'importuner l'ensemble des membres pour rien.
 *
 * La valeur est décidée par le serveur et jamais reçue du client : sans quoi
 * un appel forgé pourrait faire consigner l'acceptation d'une version
 * arbitraire.
 */
export const CGU_VERSION = '1.0';

/** Date d'entrée en vigueur de la version ci-dessus, au format ISO. */
export const CGU_ENTREE_EN_VIGUEUR = '2026-08-18';
