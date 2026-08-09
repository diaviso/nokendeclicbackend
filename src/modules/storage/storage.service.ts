import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { extname } from 'path';

export interface StoredFile {
  /** Clé de l'objet dans le bucket, ex. `offres/8f3c….pdf`. */
  key: string;
  /** URL publique complète, telle que persistée en base. */
  url: string;
  size: number;
  mimetype: string;
  originalName: string;
}

/**
 * Stockage objet sur Cloudflare R2 (API compatible S3).
 *
 * Remplace l'écriture sur le système de fichiers du conteneur, qui est éphémère
 * sur Railway : le répertoire `uploads/` était réinitialisé à chaque
 * déploiement, ce qui a déjà entraîné la perte de l'intégralité des fichiers
 * référencés en base (constat H5 de l'audit).
 *
 * La configuration est lue depuis l'environnement — aucune valeur sensible
 * n'est présente dans le dépôt.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client: S3Client | null = null;
  private bucket = '';
  private publicUrl = '';

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const accountId = this.configService.get<string>('r2.accountId');
    const accessKeyId = this.configService.get<string>('r2.accessKeyId');
    const secretAccessKey = this.configService.get<string>('r2.secretAccessKey');
    const bucket = this.configService.get<string>('r2.bucket');
    const publicUrl = this.configService.get<string>('r2.publicUrl');

    const manquantes = [
      ['R2_ACCOUNT_ID', accountId],
      ['R2_ACCESS_KEY_ID', accessKeyId],
      ['R2_SECRET_ACCESS_KEY', secretAccessKey],
      ['R2_BUCKET', bucket],
      // R2_PUBLIC_URL est indispensable, pas optionnelle : l'URL absolue de
      // l'objet est persistée en base. Sans domaine public, on écrirait des
      // liens irrécupérables — mieux vaut refuser la configuration que
      // produire des enregistrements cassés.
      ['R2_PUBLIC_URL', publicUrl],
    ]
      .filter(([, valeur]) => !valeur)
      .map(([nom]) => nom);

    if (manquantes.length) {
      // Le démarrage n'est pas bloqué : l'application reste utilisable sans
      // stockage, seuls les envois de fichiers sont refusés.
      this.logger.warn(
        `Stockage R2 incomplet — envois de fichiers désactivés. ` +
          `Variable(s) manquante(s) : ${manquantes.join(', ')}. ` +
          `R2_PUBLIC_URL est le domaine public du bucket (domaine personnalisé ` +
          `ou URL r2.dev si l'accès public est activé).`,
      );
      return;
    }

    this.bucket = bucket!;
    this.publicUrl = publicUrl!.replace(/\/+$/, '');

    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      // Les valeurs sont garanties non vides par le contrôle ci-dessus, que
      // TypeScript ne peut pas suivre à travers le tableau de vérification.
      credentials: {
        accessKeyId: accessKeyId!,
        secretAccessKey: secretAccessKey!,
      },
    });

    this.logger.log(`Stockage R2 actif — bucket « ${bucket} »`);
  }

  get isConfigured(): boolean {
    return this.client !== null;
  }

  private assertReady(): S3Client {
    if (!this.client) {
      throw new InternalServerErrorException(
        "Le stockage de fichiers n'est pas configuré sur ce serveur.",
      );
    }
    return this.client;
  }

  /**
   * Envoie un fichier reçu par multer (en mémoire) et renvoie son URL publique.
   * Le nom d'origine n'est jamais utilisé comme clé : il est conservé
   * séparément en base, ce qui évite toute traversée de chemin.
   */
  async upload(
    file: Express.Multer.File,
    folder: string,
  ): Promise<StoredFile> {
    const client = this.assertReady();

    if (!file?.buffer) {
      throw new InternalServerErrorException(
        'Fichier illisible : le stockage mémoire est requis pour l’envoi vers R2.',
      );
    }

    const extension = extname(file.originalname).toLowerCase();
    const key = `${folder}/${randomUUID()}${extension}`;

    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        // Le nom d'origine part en métadonnée, encodé : les en-têtes S3
        // n'acceptent pas les caractères non ASCII.
        Metadata: {
          'original-name': encodeURIComponent(file.originalname),
        },
      }),
    );

    return {
      key,
      url: this.urlFor(key),
      size: file.size,
      mimetype: file.mimetype,
      originalName: file.originalname,
    };
  }

  async delete(keyOrUrl: string): Promise<void> {
    const client = this.assertReady();
    const key = this.keyFrom(keyOrUrl);
    if (!key) return;

    try {
      await client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (error) {
      // La suppression du fichier ne doit pas faire échouer la suppression de
      // l'enregistrement : on journalise et on poursuit.
      this.logger.error(
        `Échec de suppression de l'objet « ${key} »`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  urlFor(key: string): string {
    return `${this.publicUrl}/${key}`;
  }

  /** Retrouve la clé à partir d'une URL publique, ou la renvoie telle quelle. */
  keyFrom(keyOrUrl: string): string | null {
    if (!keyOrUrl) return null;
    if (!keyOrUrl.startsWith('http')) return keyOrUrl.replace(/^\/+/, '');
    if (this.publicUrl && keyOrUrl.startsWith(this.publicUrl)) {
      return keyOrUrl.slice(this.publicUrl.length).replace(/^\/+/, '');
    }
    try {
      return new URL(keyOrUrl).pathname.replace(/^\/+/, '');
    } catch {
      return null;
    }
  }
}
