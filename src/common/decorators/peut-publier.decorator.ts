import { applyDecorators, UseGuards } from '@nestjs/common';
import { Role } from '../../generated/prisma';
import { Roles } from './roles.decorator';
import { RolesGuard } from '../guards/roles.guard';

/**
 * Réserve une route à ceux qui ont le droit de publier une offre :
 * l'administration et les partenaires.
 *
 * Le décorateur assemble la garde et la liste des rôles, parce que les oublier
 * ensemble est facile et silencieux : `RolesGuard` laisse passer quand aucun
 * `@Roles` n'est déclaré, et `@Roles` sans `@UseGuards` n'est jamais lu. Les
 * routes de mutation d'offres n'avaient ni l'un ni l'autre — n'importe quel
 * compte connecté pouvait publier en appelant l'API directement, seule
 * l'interface masquait le bouton.
 *
 * La possession reste vérifiée séparément, dans le service : un partenaire ne
 * touche qu'à ses propres offres, un administrateur à toutes.
 */
export const PeutPublier = () =>
  applyDecorators(
    UseGuards(RolesGuard),
    Roles(Role.ADMIN, Role.PARTENAIRE),
  );
