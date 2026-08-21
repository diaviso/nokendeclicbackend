import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { PrismaService } from '../../prisma/prisma.service';
import { ChatMessageDto } from './dto';
import { ChatbotToolsService } from './chatbot-tools.service';

/** Ce qui transite sur le flux, du serveur vers le navigateur. */
export type EvenementFlux =
  | { type: 'debut'; conversationId: string }
  | { type: 'morceau'; texte: string }
  | { type: 'outil'; nom: string }
  | { type: 'fin'; conversationId: string }
  | { type: 'erreur'; message: string };

@Injectable()
export class ChatbotService {
  private openai: OpenAI;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private toolsService: ChatbotToolsService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('openai.apiKey'),
    });
  }

  private getTools(): OpenAI.Chat.Completions.ChatCompletionTool[] {
    return [
      {
        type: 'function',
        function: {
          name: 'get_user_profile',
          description: "Récupère les informations du profil de l'utilisateur connecté (nom, prénom, email, localisation, statut professionnel)",
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_user_cv',
          description: "Récupère le CV complet de l'utilisateur (titre professionnel, résumé, compétences, langues, certifications)",
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_user_experiences',
          description: "Récupère les expériences professionnelles de l'utilisateur (postes, entreprises, dates, descriptions)",
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_user_formations',
          description: "Récupère les formations et diplômes de l'utilisateur",
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_user_competences',
          description: "Récupère la liste des compétences de l'utilisateur",
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_offres_matching_competences',
          description: "Trouve les offres d'emploi qui correspondent aux compétences de l'utilisateur",
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_offres_matching_experience',
          description: "Trouve les offres qui correspondent aux expériences professionnelles de l'utilisateur",
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_recommandations_personnalisees',
          description: "Génère des recommandations d'offres personnalisées basées sur le profil complet de l'utilisateur",
        },
      },
      {
        type: 'function',
        function: {
          name: 'analyser_cv',
          description: "Analyse le CV de l'utilisateur et donne des conseils d'amélioration (complétude, points forts, points à améliorer)",
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_user_favoris',
          description: "Récupère les offres que l'utilisateur a mis en favoris",
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_user_candidatures',
          description: "Récupère les candidatures/retours de l'utilisateur sur les offres",
        },
      },
      {
        type: 'function',
        function: {
          name: 'search_offres',
          description: "Recherche des offres par mots-clés (titre, description, entreprise, localisation)",
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Mots-clés de recherche',
              },
            },
            required: ['query'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_offres_par_localisation',
          description: "Récupère les offres disponibles dans une localisation spécifique",
          parameters: {
            type: 'object',
            properties: {
              localisation: {
                type: 'string',
                description: 'Nom de la ville ou région (ex: Ziguinchor, Dakar, Casamance)',
              },
            },
            required: ['localisation'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_offres_par_type',
          description: "Récupère les offres par type (EMPLOI, FORMATION, BOURSE, VOLONTARIAT, PROGRAMME)",
          parameters: {
            type: 'object',
            properties: {
              typeOffre: {
                type: 'string',
                enum: ['EMPLOI', 'FORMATION', 'BOURSE', 'VOLONTARIAT', 'PROGRAMME'],
                description: "Type d'offre",
              },
            },
            required: ['typeOffre'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_offres_par_secteur',
          description: "Récupère les offres par secteur d'activité",
          parameters: {
            type: 'object',
            properties: {
              secteur: {
                type: 'string',
                description: "Secteur d'activité (ex: INFORMATIQUE, FINANCE, SANTE, TOURISME, AGRICULTURE)",
              },
            },
            required: ['secteur'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_formations_disponibles',
          description: "Récupère toutes les formations disponibles sur la plateforme",
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_bourses_disponibles',
          description: "Récupère toutes les bourses d'études disponibles",
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_volontariats_disponibles',
          description: "Récupère toutes les offres de volontariat disponibles (service civique, missions humanitaires, bénévolat)",
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_statistiques_offres',
          description: "Récupère les statistiques globales des offres (total, par type, par secteur, par localisation)",
        },
      },

      /* ------------------------------------------------ Lire en détail --- */

      {
        type: 'function',
        function: {
          name: 'get_offre_details',
          description:
            "Fiche complète d'une offre : description entière, rémunération, date limite, jours restants, et surtout COMMENT POSTULER (instructions, email, lien). À appeler dès qu'une question porte sur une offre précise.",
          parameters: {
            type: 'object',
            properties: {
              offreId: {
                type: 'integer',
                description: "Identifiant de l'offre, tel que renvoyé par les recherches",
              },
            },
            required: ['offreId'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'recherche_avancee',
          description:
            "Recherche en croisant plusieurs critères à la fois (mots-clés + type + secteur + lieu + niveau + échéance). À préférer aux recherches par critère unique dès que la demande en combine plusieurs. Appeler d'abord get_referentiels pour connaître les valeurs acceptées.",
          parameters: {
            type: 'object',
            properties: {
              motsCles: { type: 'string', description: 'Mots-clés libres' },
              typeOffre: {
                type: 'string',
                description: "Code ou libellé du type (voir get_referentiels)",
              },
              secteur: {
                type: 'string',
                description: 'Secteur exact, en majuscules (voir get_referentiels)',
              },
              localisation: { type: 'string', description: 'Ville ou région' },
              niveauExperience: {
                type: 'string',
                enum: ['DEBUTANT', 'JUNIOR', 'CONFIRME', 'SENIOR', 'EXPERT'],
              },
              typeEmploi: {
                type: 'string',
                enum: [
                  'CDI',
                  'CDD',
                  'STAGE',
                  'ALTERNANCE',
                  'FREELANCE',
                  'INTERIM',
                  'SAISONNIER',
                  'TEMPS_PARTIEL',
                  'TEMPS_PLEIN',
                ],
              },
              teletravailUniquement: { type: 'boolean' },
              echeance: {
                type: 'string',
                enum: ['ouverte', 'depassee'],
                description:
                  "« ouverte » écarte les offres dont la date limite est passée — à utiliser par défaut quand la personne cherche à postuler",
              },
              limite: {
                type: 'integer',
                description: 'Nombre de résultats souhaité (1 à 40, 15 par défaut)',
              },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_offres_echeance_proche',
          description:
            "Offres dont la date limite approche, de la plus urgente à la moins urgente. Pour « qu'est-ce qui ferme bientôt ? » ou pour alerter sur une occasion à ne pas manquer.",
          parameters: {
            type: 'object',
            properties: {
              jours: {
                type: 'integer',
                description: 'Fenêtre en jours (1 à 90, 14 par défaut)',
              },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_referentiels',
          description:
            "Valeurs acceptées par les filtres : types d'offres, secteurs réellement présents, niveaux, types de contrat, localisations fréquentes. À appeler avant une recherche filtrée plutôt que de deviner une valeur — un secteur inventé ne renvoie rien.",
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_entreprises_partenaires',
          description:
            'Structures partenaires visibles sur la plateforme (nom, secteur, site, ville)',
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_retours_offre',
          description:
            "Retours d'expérience laissés par des candidats sur une offre",
          parameters: {
            type: 'object',
            properties: {
              offreId: { type: 'integer' },
            },
            required: ['offreId'],
          },
        },
      },

      /* --------------------------------------- Confronter au profil ------ */

      {
        type: 'function',
        function: {
          name: 'comparer_profil_offre',
          description:
            "Confronte le CV de la personne à une offre précise : compétences qui correspondent, mots-clés de l'annonce absents du CV, proximité géographique. À utiliser pour « est-ce que je peux postuler ? », « qu'est-ce qui me manque ? », « suis-je un bon profil ? ».",
          parameters: {
            type: 'object',
            properties: {
              offreId: { type: 'integer' },
            },
            required: ['offreId'],
          },
        },
      },

      /* --------------------------------------------------- Agir ---------- */

      {
        type: 'function',
        function: {
          name: 'ajouter_favori',
          description:
            "Enregistre une offre dans les favoris de la personne. N'appeler que si elle le demande explicitement.",
          parameters: {
            type: 'object',
            properties: {
              offreId: { type: 'integer' },
            },
            required: ['offreId'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'retirer_favori',
          description: 'Retire une offre des favoris de la personne.',
          parameters: {
            type: 'object',
            properties: {
              offreId: { type: 'integer' },
            },
            required: ['offreId'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'creer_alerte',
          description:
            "Enregistre une alerte : la personne sera prévenue des nouvelles offres correspondant à ces critères. N'appeler que sur demande explicite, et avec au moins un critère.",
          parameters: {
            type: 'object',
            properties: {
              motsCles: { type: 'string' },
              typeOffre: { type: 'string' },
              secteur: { type: 'string' },
              localisation: { type: 'string' },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_mes_alertes',
          description: 'Alertes déjà enregistrées par la personne',
        },
      },
    ];
  }

  private async executeTool(toolName: string, args: any, userId: number): Promise<string> {
    let result: any;

    switch (toolName) {
      case 'get_user_profile':
        result = await this.toolsService.getUserProfile(userId);
        break;
      case 'get_user_cv':
        result = await this.toolsService.getUserCV(userId);
        break;
      case 'get_user_experiences':
        result = await this.toolsService.getUserExperiences(userId);
        break;
      case 'get_user_formations':
        result = await this.toolsService.getUserFormations(userId);
        break;
      case 'get_user_competences':
        result = await this.toolsService.getUserCompetences(userId);
        break;
      case 'get_offres_matching_competences':
        result = await this.toolsService.getOffresMatchingCompetences(userId);
        break;
      case 'get_offres_matching_experience':
        result = await this.toolsService.getOffresMatchingExperience(userId);
        break;
      case 'get_recommandations_personnalisees':
        result = await this.toolsService.getRecommandationsPersonnalisees(userId);
        break;
      case 'analyser_cv':
        result = await this.toolsService.analyserCV(userId);
        break;
      case 'get_user_favoris':
        result = await this.toolsService.getUserFavoris(userId);
        break;
      case 'get_user_candidatures':
        result = await this.toolsService.getUserRetours(userId);
        break;
      case 'search_offres':
        result = await this.toolsService.searchOffres(args.query);
        break;
      case 'get_offres_par_localisation':
        result = await this.toolsService.getOffresParLocalisation(args.localisation);
        break;
      case 'get_offres_par_type':
        result = await this.toolsService.getOffresParType(args.typeOffre);
        break;
      case 'get_offres_par_secteur':
        result = await this.toolsService.getOffresParSecteur(args.secteur);
        break;
      case 'get_formations_disponibles':
        result = await this.toolsService.getFormationsDisponibles();
        break;
      case 'get_bourses_disponibles':
        result = await this.toolsService.getBoursesDisponibles();
        break;
      case 'get_volontariats_disponibles':
        result = await this.toolsService.getVolontariatsDisponibles();
        break;
      case 'get_offre_details':
        result = await this.toolsService.getOffreDetails(
          Number(args.offreId),
          userId,
        );
        break;
      case 'recherche_avancee':
        result = await this.toolsService.rechercheAvancee(args ?? {});
        break;
      case 'get_offres_echeance_proche':
        result = await this.toolsService.getOffresEcheanceProche(
          args?.jours ? Number(args.jours) : undefined,
        );
        break;
      case 'get_referentiels':
        result = await this.toolsService.getReferentiels();
        break;
      case 'get_entreprises_partenaires':
        result = await this.toolsService.getEntreprisesPartenaires();
        break;
      case 'get_retours_offre':
        result = await this.toolsService.getRetoursOffre(Number(args.offreId));
        break;
      case 'comparer_profil_offre':
        result = await this.toolsService.comparerProfilOffre(
          userId,
          Number(args.offreId),
        );
        break;
      case 'ajouter_favori':
        result = await this.toolsService.ajouterFavori(
          userId,
          Number(args.offreId),
        );
        break;
      case 'retirer_favori':
        result = await this.toolsService.retirerFavori(
          userId,
          Number(args.offreId),
        );
        break;
      case 'creer_alerte':
        result = await this.toolsService.creerAlerte(userId, args ?? {});
        break;
      case 'get_mes_alertes':
        result = await this.toolsService.getMesAlertes(userId);
        break;
      case 'get_statistiques_offres':
        result = await this.toolsService.getStatistiquesOffres();
        break;
      default:
        result = { error: `Outil inconnu: ${toolName}` };
    }

    return JSON.stringify(result, null, 2);
  }

  async chat(dto: ChatMessageDto, userId: number) {
    let conversation = dto.conversationId
      ? await this.prisma.conversation.findUnique({
          where: { id: dto.conversationId },
          include: { messages: { orderBy: { timestamp: 'asc' }, take: 20 } },
        })
      : null;

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          userId,
          title: dto.message.substring(0, 50),
        },
        include: { messages: true },
      });
    }

    // Save user message
    await this.prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: dto.message,
      },
    });

    // Build messages for OpenAI
    const systemPrompt = this.getSystemPrompt();
    const messages: any[] = [
      {
        role: 'system',
        content: systemPrompt,
      },
      ...conversation.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: 'user', content: dto.message },
    ];

    // Call OpenAI with tools
    let completion = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      tools: this.getTools(),
      tool_choice: 'auto',
      temperature: 0.7,
      max_tokens: 2000,
    });

    let assistantMessage = completion.choices[0]?.message as any;

    // Handle tool calls
    while (assistantMessage?.tool_calls && assistantMessage.tool_calls.length > 0) {
      // Add assistant message with tool calls
      messages.push({
        role: 'assistant',
        content: assistantMessage.content || '',
        tool_calls: assistantMessage.tool_calls,
      });

      // Execute each tool and add results
      for (const toolCall of assistantMessage.tool_calls) {
        const args = toolCall.function?.arguments ? JSON.parse(toolCall.function.arguments) : {};
        const toolResult = await this.executeTool(toolCall.function?.name || '', args, userId);

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: toolResult,
        });
      }

      // Get next response
      completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        tools: this.getTools(),
        tool_choice: 'auto',
        temperature: 0.7,
        max_tokens: 2000,
      });

      assistantMessage = completion.choices[0]?.message as any;
    }

    const finalResponse = assistantMessage?.content || 'Désolé, je n\'ai pas pu générer une réponse.';

    // Save assistant message
    await this.prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: finalResponse,
      },
    });

    return {
      response: finalResponse,
      conversationId: conversation.id,
    };
  }

  /**
   * Même conversation que `chat`, mais rendue au fil de l'eau.
   *
   * L'appel est diffusé dès le premier jeton plutôt qu'attendu en entier : sur
   * une réponse de quinze lignes, l'utilisateur voit apparaître le texte au
   * bout d'une seconde au lieu de fixer un indicateur pendant dix.
   *
   * Les appels d'outils arrivent eux aussi par fragments : ils sont accumulés
   * par index, exécutés, puis un nouvel appel est ouvert. Seul le texte est
   * diffusé — un outil n'a rien à montrer, sinon la mention de ce qu'il
   * consulte.
   */
  async *chatEnFlux(
    dto: ChatMessageDto,
    userId: number,
  ): AsyncGenerator<EvenementFlux> {
    let conversation = dto.conversationId
      ? await this.prisma.conversation.findUnique({
          where: { id: dto.conversationId },
          include: { messages: { orderBy: { timestamp: 'asc' }, take: 20 } },
        })
      : null;

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: { userId, title: dto.message.substring(0, 50) },
        include: { messages: true },
      });
    }

    await this.prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: dto.message,
      },
    });

    yield { type: 'debut', conversationId: conversation.id };

    const messages: any[] = [
      { role: 'system', content: this.getSystemPrompt() },
      ...conversation.messages.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: dto.message },
    ];

    let texteFinal = '';

    // Borne le nombre d'allers-retours : un modèle qui rappellerait sans fin le
    // même outil consommerait le budget sans jamais répondre.
    for (let tour = 0; tour < 5; tour++) {
      const flux = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        tools: this.getTools(),
        tool_choice: 'auto',
        temperature: 0.7,
        max_tokens: 2000,
        stream: true,
      });

      let contenu = '';
      const appels: {
        id: string;
        nom: string;
        arguments: string;
      }[] = [];

      for await (const morceau of flux) {
        const delta = morceau.choices[0]?.delta;
        if (!delta) continue;

        if (delta.content) {
          contenu += delta.content;
          texteFinal += delta.content;
          yield { type: 'morceau', texte: delta.content };
        }

        // Les appels d'outils arrivent en fragments à recoller : le nom vient
        // en général avec le premier, les arguments par morceaux ensuite.
        for (const fragment of delta.tool_calls ?? []) {
          const index = fragment.index ?? 0;
          appels[index] ??= { id: '', nom: '', arguments: '' };
          if (fragment.id) appels[index].id = fragment.id;
          if (fragment.function?.name) appels[index].nom += fragment.function.name;
          if (fragment.function?.arguments) {
            appels[index].arguments += fragment.function.arguments;
          }
        }
      }

      const aExecuter = appels.filter((appel) => appel?.nom);
      if (aExecuter.length === 0) break;

      messages.push({
        role: 'assistant',
        content: contenu,
        tool_calls: aExecuter.map((appel) => ({
          id: appel.id,
          type: 'function',
          function: { name: appel.nom, arguments: appel.arguments || '{}' },
        })),
      });

      for (const appel of aExecuter) {
        yield { type: 'outil', nom: appel.nom };

        let args: Record<string, unknown> = {};
        try {
          args = appel.arguments ? JSON.parse(appel.arguments) : {};
        } catch {
          // Arguments tronqués : l'outil est appelé sans paramètre plutôt que
          // de faire échouer toute la réponse.
          args = {};
        }

        const resultat = await this.executeTool(appel.nom, args, userId);
        messages.push({
          role: 'tool',
          tool_call_id: appel.id,
          content: resultat,
        });
      }
    }

    const reponse =
      texteFinal.trim() ||
      "Désolé, je n'ai pas pu générer une réponse.";

    await this.prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: reponse,
      },
    });

    yield { type: 'fin', conversationId: conversation.id };
  }

  async getConversations(userId: number) {
    return this.prisma.conversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async getConversation(conversationId: string, userId: number) {
    return this.prisma.conversation.findFirst({
      where: { id: conversationId, userId },
      include: {
        messages: { orderBy: { timestamp: 'asc' } },
      },
    });
  }

  async deleteConversation(conversationId: string, userId: number) {
    await this.prisma.conversation.deleteMany({
      where: { id: conversationId, userId },
    });
    return { message: 'Conversation supprimée' };
  }

  getSuggestions() {
    return [
      'Quelles sont les offres d\'emploi disponibles ?',
      'Montre-moi les formations récentes',
      'Quelles bourses sont disponibles ?',
      'Quels sont les secteurs les plus actifs ?',
      'Comment améliorer mon CV ?',
      'Quelles compétences sont les plus demandées ?',
    ];
  }

  private async getContextData() {
    // L'assistant ne decrit que le catalogue reellement consultable : un depot
    // de partenaire en attente de relecture n'existe pas encore pour un membre.
    const publiees = { statutModeration: 'PUBLIEE' as const };

    const [offresCount, usersCount, cvCount, topSecteurs] = await Promise.all([
      this.prisma.offre.count({ where: publiees }),
      this.prisma.user.count(),
      this.prisma.cV.count({ where: { estPublic: true } }),
      this.prisma.offre.groupBy({
        by: ['secteur'],
        where: publiees,
        _count: { secteur: true },
        orderBy: { _count: { secteur: 'desc' } },
        take: 5,
      }),
    ]);

    const recentOffres = await this.prisma.offre.findMany({
      where: publiees,
      take: 10,
      orderBy: { datePublication: 'desc' },
      select: {
        id: true,
        titre: true,
        typeOffre: true,
        secteur: true,
        localisation: true,
        entreprise: true,
      },
    });

    return {
      offresCount,
      usersCount,
      cvCount,
      topSecteurs,
      recentOffres,
    };
  }

  private getSystemPrompt() {
    return `Tu es l'assistant de Noken, une plateforme sénégalaise d'aide à l'emploi, aux formations et aux bourses, particulièrement attentive à la Casamance (Ziguinchor, Kolda, Sédhiou, Cap Skirring, Oussouye).

## Ton rôle
Conseiller carrière. Tu connais le catalogue et le dossier de la personne à qui tu parles, et tu t'en sers pour l'aider à agir : trouver ce qui lui correspond, comprendre ce qui lui manque, et savoir quoi faire ensuite.

## Comment travailler
1. **Regarde avant de répondre.** Toute affirmation sur le catalogue ou sur la personne vient d'un outil, jamais de ta mémoire. Tu n'inventes ni une offre, ni une date, ni une adresse de candidature.
2. **Enchaîne les outils.** Une bonne réponse en demande souvent plusieurs : lire le profil, chercher, ouvrir la fiche, comparer. Ne t'arrête pas au premier résultat s'il ne suffit pas à répondre.
3. **Vérifie tes filtres.** Avant une recherche filtrée, appelle \`get_referentiels\` : un secteur ou un type inventé ne renvoie rien, et tu conclurais à tort qu'il n'y a rien.
4. **Croise les critères.** \`recherche_avancee\` remplace avantageusement les recherches à critère unique dès que la demande en combine plusieurs.
5. **Écarte le périmé.** Quand la personne cherche à postuler, passe \`echeance: "ouverte"\` : proposer une offre close est une perte de temps pour elle.
6. **Ouvre la fiche.** Dès qu'une offre précise est en jeu — « comment postuler ? », « c'est quoi exactement ? », « jusqu'à quand ? » — appelle \`get_offre_details\`. Les listes ne contiennent pas les modalités de candidature.
7. **Confronte au profil.** Pour « est-ce que je peux postuler ? » ou « qu'est-ce qui me manque ? », utilise \`comparer_profil_offre\` plutôt que de juger au jugé.

## Agir sur le compte
\`ajouter_favori\`, \`retirer_favori\` et \`creer_alerte\` modifient le compte de la personne. Ne les appelle que si elle le demande, et dis ensuite ce que tu as fait. Tu ne postules jamais à sa place : une candidature l'engage, elle seule la décide.

## Ta réponse
- En français, au ton direct et chaleureux, sans jargon.
- Courte. Trois offres bien présentées valent mieux que quinze en vrac.
- En Markdown, avec le titre de l'offre en gras et son lien \`/offres/{id}\` pour qu'on puisse l'ouvrir.
- Les dates limites proches se signalent : « plus que 5 jours ».
- Termine par la prochaine action utile, quand il y en a une : compléter le CV, mettre en favori, créer une alerte.
- Ce que tu n'as pas trouvé, dis-le. « Aucune offre ne correspond à ces critères aujourd'hui » est une réponse honnête ; en inventer une ne l'est pas. Propose alors d'élargir.
- Sans CV, la moitié de tes outils ne peut rien dire : invite à en créer un, en expliquant ce que cela débloquera.

## Exemples
- « Quelles offres correspondent à mon profil ? »
- « Analyse mon CV et dis-moi comment l'améliorer »
- « Une formation en informatique à Ziguinchor, encore ouverte »
- « Est-ce que je peux postuler à l'offre 42 ? »
- « Qu'est-ce qui ferme dans les deux semaines ? »
- « Mets celle-là en favori et préviens-moi des prochaines du même genre »`;
  }
}
