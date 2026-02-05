import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  ParseIntPipe,
  Request,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UploadService } from './upload.service';

@ApiTags('Upload')
@Controller('upload')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('offre/:offreId')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a file for an offer' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async uploadOffreFile(
    @Param('offreId', ParseIntPipe) offreId: number,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    return this.uploadService.addFileToOffre(
      offreId,
      file,
      req.user.id,
      req.user.role,
    );
  }

  @Post('offre/:offreId/multiple')
  @UseInterceptors(FilesInterceptor('files', 10))
  @ApiOperation({ summary: 'Upload multiple files for an offer' })
  @ApiConsumes('multipart/form-data')
  async uploadMultipleOffreFiles(
    @Param('offreId', ParseIntPipe) offreId: number,
    @UploadedFiles() files: Express.Multer.File[],
    @Request() req: any,
  ) {
    const results: any[] = [];
    for (const file of files) {
      const result = await this.uploadService.addFileToOffre(
        offreId,
        file,
        req.user.id,
        req.user.role,
      );
      results.push(result);
    }
    return results;
  }

  @Get('offre/:offreId')
  @ApiOperation({ summary: 'Get all files for an offer' })
  async getOffreFiles(@Param('offreId', ParseIntPipe) offreId: number) {
    return this.uploadService.getOffreFichiers(offreId);
  }

  @Delete(':fichierId')
  @ApiOperation({ summary: 'Delete a file' })
  async deleteFile(
    @Param('fichierId', ParseIntPipe) fichierId: number,
    @Request() req: any,
  ) {
    return this.uploadService.deleteFichier(fichierId, req.user.id, req.user.role);
  }

  @Patch(':fichierId')
  @ApiOperation({ summary: 'Update file name' })
  async updateFileName(
    @Param('fichierId', ParseIntPipe) fichierId: number,
    @Body('nom') nom: string,
    @Request() req: any,
  ) {
    return this.uploadService.updateFichierName(
      fichierId,
      nom,
      req.user.id,
      req.user.role,
    );
  }
}
