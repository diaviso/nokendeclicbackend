import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { MailController } from './mail.controller';
import { MailService } from './mail.service';

describe('MailController', () => {
  let controller: MailController;
  let sendTestEmail: jest.Mock;

  beforeEach(async () => {
    // Le stub généré par le CLI ne fournissait pas MailService : la compilation
    // du module de test échouait, et la suite était rouge en permanence.
    sendTestEmail = jest.fn().mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MailController],
      providers: [
        { provide: MailService, useValue: { sendTestEmail } },
        Reflector,
      ],
    }).compile();

    controller = module.get<MailController>(MailController);
  });

  it('est correctement instancié', () => {
    expect(controller).toBeDefined();
  });

  it("envoie l'email de test à l'adresse de l'administrateur appelant, pas à une adresse codée en dur", async () => {
    const result = await controller.testMail('admin@example.com');

    expect(sendTestEmail).toHaveBeenCalledTimes(1);
    expect(sendTestEmail).toHaveBeenCalledWith('admin@example.com');
    expect(result).toEqual({
      message: 'Email de test envoyé à admin@example.com',
    });
  });
});
