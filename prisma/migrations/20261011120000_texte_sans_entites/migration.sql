-- Texte brut des offres : entités HTML rendues à leurs caractères.
--
-- `description` et `extrait` sont du texte, affiché tel quel ; la conversion
-- depuis le contenu riche y laissait « &amp; » à la place de « & ». Seules les
-- lignes concernées sont touchées, et `&amp;` est traité en dernier pour ne
-- décoder qu'une fois (« &amp;lt; » devient « &lt; », pas « < »).
UPDATE "Offre"
SET "description" = replace(replace(replace(replace(replace(replace(
      "description", '&lt;', '<'), '&gt;', '>'), '&quot;', '"'), '&#39;', ''''), '&nbsp;', ' '), '&amp;', '&')
WHERE "description" ~ '&(amp|lt|gt|quot|#39|nbsp);';

UPDATE "Offre"
SET "extrait" = replace(replace(replace(replace(replace(replace(
      "extrait", '&lt;', '<'), '&gt;', '>'), '&quot;', '"'), '&#39;', ''''), '&nbsp;', ' '), '&amp;', '&')
WHERE "extrait" ~ '&(amp|lt|gt|quot|#39|nbsp);';
