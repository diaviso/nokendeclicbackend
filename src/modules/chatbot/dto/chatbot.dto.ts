import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChatMessageDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  conversationId?: string;
}

export class ChatResponse {
  @ApiProperty()
  response: string;

  @ApiProperty()
  conversationId: string;
}
