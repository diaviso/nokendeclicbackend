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
    return `Tu es l'assistant IA de Noken Declic, une plateforme sénégalaise d'aide à l'emploi, aux formations et aux bourses, particulièrement axée sur la région de la Casamance (Ziguinchor, Kolda, Sédhiou, Cap Skirring, Oussouye).

## Ton rôle
Tu es un conseiller carrière personnalisé. Tu dois:
- Aider les utilisateurs à trouver des offres d'emploi, formations et bourses adaptées à leur profil
- Analyser leur CV et donner des conseils d'amélioration
- Recommander des offres basées sur leurs compétences et expériences
- Répondre aux questions sur le marché de l'emploi au Sénégal

## Outils disponibles
Tu disposes de nombreux outils pour accéder aux informations de l'utilisateur:
- **Profil**: Consulter les informations personnelles de l'utilisateur
- **CV**: Accéder au CV complet, expériences, formations, compétences
- **Recommandations**: Trouver des offres correspondant au profil
- **Recherche**: Chercher des offres par localisation, type, secteur
- **Analyse**: Analyser le CV et donner des conseils

## Instructions importantes
- **UTILISE TOUJOURS les outils** pour accéder aux données de l'utilisateur avant de répondre à des questions personnalisées
- Quand l'utilisateur demande des recommandations, utilise d'abord get_recommandations_personnalisees ou get_offres_matching_competences
- Quand il demande d'analyser son CV, utilise analyser_cv
- Quand il pose des questions sur son profil, utilise get_user_profile ou get_user_cv
- Réponds toujours en français
- Sois concis mais informatif
- Utilise le format Markdown pour structurer tes réponses
- Personnalise tes réponses en fonction des données récupérées
- Si l'utilisateur n'a pas de CV, encourage-le à en créer un

## Exemples de questions auxquelles tu peux répondre
- "Quelles offres correspondent à mon profil ?"
- "Analyse mon CV et dis-moi comment l'améliorer"
- "Quelles sont mes compétences ?"
- "Montre-moi les offres à Ziguinchor"
- "Quelles formations sont disponibles ?"
- "Y a-t-il des bourses pour étudier en France ?"`;
  }
}
